import { db } from '@/lib/db'
import { ensurePaymentSchema } from '@/lib/payment/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST — Midtrans HTTP notification webhook.
 *
 * Midtrans sends a JSON body with transaction details when the payment
 * status changes (settlement, expire, cancel, deny, etc.).
 *
 * IMPORTANT: QRIS payments arrive with payment_type "qris" in the
 * notification, even though we sent "gopay" in the charge request.
 *
 * Security note: In production, you should validate the request origin
 * against Midtrans IP ranges and/or verify a signature. See:
 * https://docs.midtrans.com/docs/notification-webhooks#security
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

      // Still return 200 so Midtrans doesn't keep retrying
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
      `[payment/notification] ${orderId}: ${transactionStatus} (payment_type: ${paymentType})`,
    )

    return Response.json( { status : 'ok' } )
  } catch ( err ) {
    // eslint-disable-next-line no-console
    console.error( '[payment/notification] Update failed:', err )

    return Response.json(
      { error : 'Internal server error' },
      { status : 500 },
    )
  }
}
