import { requireBooth } from '@/lib/auth/booth'
import {
  createPaymentCharge,
  validatePaymentConfig,
} from '@/lib/payment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST — Create a QRIS payment charge for the authenticated booth.
 *
 * Body:
 *   sessionId   — the photobooth session this payment is for
 *   grossAmount — optional, defaults to gateway payment amount or 15000
 *
 * Returns:
 *   orderId, transactionId, qrCodeUrl, deeplinkUrl, transactionStatus
 */
export async function POST( request : Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  // Validate payment gateway configuration
  const configError = validatePaymentConfig()
  if ( configError ) {
    return Response.json( { error : configError }, { status : 500 } )
  }

  let sessionId : string
  let grossAmount : number | undefined

  try {
    const body = await request.json()
    sessionId = String( body.sessionId ?? '' ).trim().slice( 0, 32 )
    grossAmount =
      typeof body.grossAmount === 'number' && body.grossAmount > 0
        ? body.grossAmount
        : undefined

    if ( !sessionId ) {
      return Response.json( { error : 'Missing sessionId' }, { status : 400 } )
    }
  } catch {
    // eslint-disable-next-line no-console
    console.error( '[booth/payment/charge] Invalid JSON body' )

    return Response.json( { error : 'Invalid JSON body' }, { status : 400 } )
  }

  try {
    const payment = await createPaymentCharge( {
      boothId : auth.id,
      sessionId,
      grossAmount,
    } )

    return Response.json(
      {
        orderId           : payment.orderId,
        transactionId     : payment.transactionId,
        transactionStatus : payment.transactionStatus,
        qrCodeUrl         : payment.qrCodeUrl,
        deeplinkUrl       : payment.deeplinkUrl,
        grossAmount       : payment.grossAmount,
        expiryTime        : payment.expiryTime ?? null,
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
