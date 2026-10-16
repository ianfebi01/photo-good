import { db } from '@/lib/db'
import { ensurePaymentSchema } from '@/lib/payment/schema'
import {
  normalizeDokuStatus,
  buildNotifySuccessResponse,
} from '@/lib/payment/doku'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST — Payment HTTP notification webhook.
 * Supports both Midtrans and DOKU SNAP QRIS notification payloads.
 */
export async function POST( request : Request ) {
  let body : Record<string, unknown>

  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    // eslint-disable-next-line no-console
    console.error( '[payment/notification] Invalid JSON body' )

    return Response.json( { error : 'Invalid JSON body' }, { status : 400 } )
  }

  // Detect DOKU SNAP QRIS notification
  const isDoku = typeof body.originalPartnerReferenceNo === 'string'
  if ( isDoku ) {
    const orderId = body.originalPartnerReferenceNo as string
    const dokuStatus = typeof body.latestTransactionStatus === 'string'
      ? body.latestTransactionStatus
      : '06'
    const normalizedStatus = normalizeDokuStatus( dokuStatus )

    try {
      await ensurePaymentSchema()

      await db.query(
        `UPDATE app_payments
         SET transaction_status = $1,
             transaction_id     = COALESCE($2, transaction_id),
             payment_type       = 'qris',
             raw_response       = $3,
             updated_at         = NOW()
         WHERE order_id = $4`,
        [
          normalizedStatus,
          typeof body.originalReferenceNo === 'string' ? body.originalReferenceNo : null,
          JSON.stringify( body ),
          orderId,
        ],
      )

      // eslint-disable-next-line no-console
      console.log(
        `[payment/notification] (DOKU) ${orderId}: ${normalizedStatus}`,
      )

      return Response.json( buildNotifySuccessResponse() )
    } catch ( err ) {
      // eslint-disable-next-line no-console
      console.error( '[payment/notification] DOKU update failed:', err )

      return Response.json(
        { responseCode : '5002400', responseMessage : 'Internal server error' },
        { status : 500 },
      )
    }
  }

  // Midtrans notification
  const orderId = typeof body.order_id === 'string' ? body.order_id : null
  const transactionStatus =
    typeof body.transaction_status === 'string' ? body.transaction_status : null
  const transactionId =
    typeof body.transaction_id === 'string' ? body.transaction_id : null
  const paymentType =
    typeof body.payment_type === 'string' ? body.payment_type : null

  if ( !orderId || !transactionStatus ) {
    return Response.json(
      { error : 'Missing order_id or transaction_status' },
      { status : 400 },
    )
  }

  try {
    await ensurePaymentSchema()

    const existing = await db.query(
      'SELECT id FROM app_payments WHERE order_id = $1 LIMIT 1',
      [orderId],
    )

    if ( existing.rows.length === 0 ) {
      // eslint-disable-next-line no-console
      console.warn( `[payment/notification] Unknown order_id: ${orderId}` )

      return Response.json( { status : 'ok', note : 'order not found' } )
    }

    await db.query(
      `UPDATE app_payments
       SET transaction_status = $1,
           transaction_id     = COALESCE($2, transaction_id),
           payment_type       = COALESCE($3, payment_type),
           raw_response       = $4,
           updated_at         = NOW()
       WHERE order_id = $5`,
      [
        transactionStatus,
        transactionId,
        paymentType,
        JSON.stringify( body ),
        orderId,
      ],
    )

    // eslint-disable-next-line no-console
    console.log(
      `[payment/notification] (Midtrans) ${orderId}: ${transactionStatus}`,
    )

    return Response.json( { status : 'ok' } )
  } catch ( err ) {
    // eslint-disable-next-line no-console
    console.error( '[payment/notification] Midtrans update failed:', err )

    return Response.json(
      { error : 'Internal server error' },
      { status : 500 },
    )
  }
}

export async function OPTIONS() {
  return new Response( null, {
    status  : 204,
    headers : {
      'Access-Control-Allow-Origin'  : '*',
      'Access-Control-Allow-Methods' : 'POST, OPTIONS',
      'Access-Control-Allow-Headers' : 'Authorization, Content-Type, X-TIMESTAMP, X-SIGNATURE, X-PARTNER-ID, X-EXTERNAL-ID, CHANNEL-ID',
    },
  } )
}
