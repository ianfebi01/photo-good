import { db } from '@/lib/db'
import { requireBooth } from '@/lib/auth/booth'
import { ensurePaymentSchema } from '@/lib/payment/schema'
import { getPaymentStatus } from '@/lib/payment'
import type { PaymentRow } from '@/lib/payment/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET — Check payment status from the booth client.
 *
 * Query params:
 *   orderId — the order ID returned from the charge endpoint
 *
 * Returns:
 *   The current transaction status from the active payment gateway (or DB fallback)
 */
export async function GET( request : Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  const { searchParams } = new URL( request.url )
  const orderId = searchParams.get( 'orderId' )

  if ( !orderId ) {
    return Response.json( { error : 'Missing orderId' }, { status : 400 } )
  }

  try {
    await ensurePaymentSchema()

    // Call authoritative payment gateway status check (DOKU or Midtrans)
    const status = await getPaymentStatus( orderId, auth.id )

    return Response.json(
      {
        orderId           : status.orderId,
        transactionId     : status.transactionId,
        transactionStatus : status.transactionStatus,
        grossAmount       : status.grossAmount,
        paymentType       : status.paymentType,
        settlementTime    : status.settlementTime ?? null,
        expiryTime        : status.expiryTime ?? null,
      },
      {
        headers : {
          'Access-Control-Allow-Origin'  : '*',
          'Access-Control-Allow-Methods' : 'GET, OPTIONS',
          'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
        },
      },
    )
  } catch ( err ) {
    // If gateway call fails, fall back to what we have in DB
    // eslint-disable-next-line no-console
    console.error( '[booth/payment/status] Gateway call failed:', err )

    try {
      const result = await db.query(
        `SELECT * FROM app_payments
         WHERE order_id = $1 AND booth_id = $2
         LIMIT 1`,
        [orderId, auth.id],
      )

      if ( result.rows.length === 0 ) {
        return Response.json( { error : 'Order not found' }, { status : 404 } )
      }

      const payment = result.rows[0] as PaymentRow

      return Response.json(
        {
          orderId           : payment.order_id,
          transactionId     : payment.transaction_id,
          transactionStatus : payment.transaction_status,
          grossAmount       : payment.gross_amount,
          paymentType       : payment.payment_type,
          qrCodeUrl         : payment.qr_code_url,
          createdAt         : payment.created_at,
        },
        {
          headers : {
            'Access-Control-Allow-Origin'  : '*',
            'Access-Control-Allow-Methods' : 'GET, OPTIONS',
            'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
          },
        },
      )
    } catch ( dbErr ) {
      // eslint-disable-next-line no-console
      console.error( '[booth/payment/status] DB fallback failed:', dbErr )

      return Response.json(
        { error : err instanceof Error ? err.message : 'Status check failed' },
        { status : 500 },
      )
    }
  }
}

export async function OPTIONS() {
  return new Response( null, {
    status  : 204,
    headers : {
      'Access-Control-Allow-Origin'  : '*',
      'Access-Control-Allow-Methods' : 'GET, OPTIONS',
      'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
    },
  } )
}
