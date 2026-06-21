import { db } from '@/lib/db'
import { requireBooth } from '@/lib/auth/booth'
import { ensurePaymentSchema } from '@/lib/payment/schema'
import {
  createQrisCharge,
  generateOrderId,
  extractQrCodeUrl,
  extractDeeplinkUrl,
  getDefaultAmount,
  validateConfig,
} from '@/lib/payment/midtrans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST — Create a QRIS payment charge for the authenticated booth.
 *
 * Body:
 *   sessionId   — the photobooth session this payment is for
 *   grossAmount — optional, defaults to MIDTRANS_PAYMENT_AMOUNT or 15000
 *
 * Returns:
 *   orderId, transactionId, qrCodeUrl, deeplinkUrl, transactionStatus
 */
export async function POST( request : Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  // Validate Midtrans is configured
  const configError = validateConfig()
  if ( configError ) {
    return Response.json( { error : configError }, { status : 500 } )
  }

  let sessionId : string
  let grossAmount : number

  try {
    const body = await request.json()
    sessionId = String( body.sessionId ?? '' ).trim().slice( 0, 32 )
    grossAmount =
      typeof body.grossAmount === 'number' && body.grossAmount > 0
        ? body.grossAmount
        : getDefaultAmount()

    if ( !sessionId ) {
      return Response.json( { error : 'Missing sessionId' }, { status : 400 } )
    }
  } catch {
    // eslint-disable-next-line no-console
    console.error( '[booth/payment/charge] Invalid JSON body' )

    return Response.json( { error : 'Invalid JSON body' }, { status : 400 } )
  }

  const orderId = generateOrderId( auth.id )

  try {
    await ensurePaymentSchema()

    const response = await createQrisCharge( {
      payment_type        : 'gopay',
      transaction_details : {
        order_id     : orderId,
        gross_amount : grossAmount,
      },
    } )

    const qrCodeUrl = extractQrCodeUrl( response )
    const deeplinkUrl = extractDeeplinkUrl( response )

    // Persist the transaction
    const result = await db.query(
      `INSERT INTO app_payments
       (booth_id, order_id, transaction_id, session_id, gross_amount,
        payment_type, transaction_status, qr_code_url, deeplink_url, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, order_id, transaction_id, transaction_status, qr_code_url, deeplink_url, created_at`,
      [
        auth.id,
        response.order_id,
        response.transaction_id,
        sessionId,
        grossAmount,
        response.payment_type,
        response.transaction_status,
        qrCodeUrl,
        deeplinkUrl,
        JSON.stringify( response ),
      ],
    )

    const payment = result.rows[0]

    return Response.json(
      {
        orderId           : payment.order_id,
        transactionId     : payment.transaction_id,
        transactionStatus : payment.transaction_status,
        qrCodeUrl         : payment.qr_code_url,
        deeplinkUrl       : payment.deeplink_url,
        grossAmount,
        booth             : {
          id   : auth.id,
          name : auth.name,
        },
      },
      {
        status  : 201,
        headers : {
          'Access-Control-Allow-Origin'  : '*',
          'Access-Control-Allow-Methods' : 'POST, OPTIONS',
          'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
        },
      },
    )
  } catch ( err ) {
    // eslint-disable-next-line no-console
    console.error( '[booth/payment/charge] Create failed:', err )

    return Response.json(
      { error : err instanceof Error ? err.message : 'Payment charge failed' },
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
      'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
    },
  } )
}
