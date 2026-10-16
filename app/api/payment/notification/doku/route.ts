import { db } from '@/lib/db'
import { ensurePaymentSchema } from '@/lib/payment/schema'
import {
  normalizeDokuStatus,
  buildNotifySuccessResponse,
} from '@/lib/payment/doku'
import type { DokuQrisNotifyRequest } from '@/lib/payment/doku'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST — DOKU SNAP QRIS payment notification webhook (QR MPM Notify).
 *
 * DOKU sends this server-to-server HTTP POST when a QRIS payment is completed,
 * expired, or cancelled.
 *
 * Expected payload:
 *   originalPartnerReferenceNo — merchant order ID (order_id)
 *   originalReferenceNo        — DOKU reference number
 *   latestTransactionStatus    — status code ("00" = success, etc.)
 */
export async function POST( request : Request ) {
  let body : DokuQrisNotifyRequest

  try {
    body = await request.json() as DokuQrisNotifyRequest
  } catch {
    // eslint-disable-next-line no-console
    console.error( '[payment/notification/doku] Invalid JSON body' )

    return Response.json(
      { responseCode : '4002400', responseMessage : 'Invalid JSON body' },
      { status : 400 },
    )
  }

  const orderId = body.originalPartnerReferenceNo
  const dokuStatus = body.latestTransactionStatus

  if ( !orderId || !dokuStatus ) {
    return Response.json(
      { responseCode : '4002401', responseMessage : 'Missing reference or status' },
      { status : 400 },
    )
  }

  const normalizedStatus = normalizeDokuStatus( dokuStatus )

  try {
    await ensurePaymentSchema()

    const existing = await db.query(
      'SELECT id FROM app_payments WHERE order_id = $1 LIMIT 1',
      [orderId],
    )

    if ( existing.rows.length === 0 ) {
      // eslint-disable-next-line no-console
      console.warn( `[payment/notification/doku] Unknown order_id: ${orderId}` )

      // Return 200 so DOKU doesn't retry indefinitely for an unknown order
      return Response.json( buildNotifySuccessResponse() )
    }

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
        body.originalReferenceNo ?? null,
        JSON.stringify( body ),
        orderId,
      ],
    )

    // eslint-disable-next-line no-console
    console.log(
      `[payment/notification/doku] ${orderId}: ${normalizedStatus} (DOKU status: ${dokuStatus})`,
    )

    return Response.json( buildNotifySuccessResponse() )
  } catch ( err ) {
    // eslint-disable-next-line no-console
    console.error( '[payment/notification/doku] Update failed:', err )

    return Response.json(
      { responseCode : '5002400', responseMessage : 'Internal server error' },
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
