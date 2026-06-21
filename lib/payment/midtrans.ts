import 'server-only'

// ── Configuration ────────────────────────────────────────────────

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY ?? ''
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true'

const BASE_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://api.midtrans.com/v2'
  : 'https://api.sandbox.midtrans.com/v2'

function authHeader() : string {
  const encoded = Buffer.from( `${MIDTRANS_SERVER_KEY}:` ).toString( 'base64' )

  return `Basic ${encoded}`
}

function commonHeaders() : HeadersInit {
  return {
    Accept         : 'application/json',
    'Content-Type' : 'application/json',
    Authorization  : authHeader(),
  }
}

// ── Types ─────────────────────────────────────────────────────────

export interface QrisChargeRequest {
  /** Midtrans payment_type — always "gopay" for QRIS */
  payment_type : 'gopay'
  transaction_details : {
    order_id : string
    gross_amount : number
  }
  customer_details? : {
    first_name? : string
    last_name? : string
    email? : string
    phone? : string
  }
  item_details? : Array<{
    id : string
    price : number
    quantity : number
    name : string
  }>
  gopay? : {
    enable_callback? : boolean
    callback_url? : string
  }
}

interface MidtransAction {
  name : string
  method : string
  url : string
}

export interface QrisChargeResponse {
  status_code : string
  status_message : string
  transaction_id : string
  order_id : string
  gross_amount : string
  currency : string
  payment_type : string
  transaction_time : string
  transaction_status : string
  fraud_status : string
  actions : MidtransAction[]
}

export interface QrisStatusResponse {
  status_code : string
  status_message : string
  transaction_id : string
  masked_card? : string
  order_id : string
  gross_amount : string
  payment_type : string
  transaction_time : string
  transaction_status : string
  fraud_status : string
  approval_code? : string
  signature_key : string
  bank? : string
  channel_response_code? : string
  channel_response_message? : string
  card_type? : string
  settlement_time? : string
  expiry_time? : string
}

// ── API Methods ───────────────────────────────────────────────────

/**
 * Create a QRIS (GoPay) charge.
 * Midtrans returns a `generate-qr-code` action URL to display as a QR image.
 */
export async function createQrisCharge(
  params : QrisChargeRequest,
) : Promise<QrisChargeResponse> {
  const res = await fetch( `${BASE_URL}/charge`, {
    method  : 'POST',
    headers : commonHeaders(),
    body    : JSON.stringify( params ),
  } )

  const body = await res.json() as Record<string, unknown>

  if ( !res.ok ) {
    throw new Error(
      `Midtrans charge failed [${res.status}]: ${JSON.stringify( body )}`,
    )
  }

  return body as unknown as QrisChargeResponse
}

/**
 * Get current transaction status from Midtrans.
 */
export async function getTransactionStatus(
  orderId : string,
) : Promise<QrisStatusResponse> {
  const url = `${BASE_URL}/${encodeURIComponent( orderId )}/status`
  const res = await fetch( url, {
    method  : 'GET',
    headers : commonHeaders(),
  } )

  const body = await res.json() as Record<string, unknown>

  if ( !res.ok ) {
    throw new Error(
      `Midtrans status check failed [${res.status}]: ${JSON.stringify( body )}`,
    )
  }

  return body as unknown as QrisStatusResponse
}

/**
 * Cancel a pending transaction.
 */
export async function cancelTransaction(
  orderId : string,
) : Promise<QrisStatusResponse> {
  const url = `${BASE_URL}/${encodeURIComponent( orderId )}/cancel`
  const res = await fetch( url, {
    method  : 'POST',
    headers : commonHeaders(),
  } )

  const body = await res.json() as Record<string, unknown>

  if ( !res.ok ) {
    throw new Error(
      `Midtrans cancel failed [${res.status}]: ${JSON.stringify( body )}`,
    )
  }

  return body as unknown as QrisStatusResponse
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Generate a unique order ID scoped to a booth.
 * Format: PG-{boothShort}-{timestamp}-{random}
 */
export function generateOrderId( boothId : string ) : string {
  const short = boothId.replace( /-/g, '' ).slice( 0, 8 )
  const ts = Date.now().toString( 36 )
  const random = Math.random().toString( 36 ).slice( 2, 8 )

  return `PG-${short}-${ts}-${random}`
}

/**
 * Extract the QR code image URL from the charge response actions.
 */
export function extractQrCodeUrl( response : QrisChargeResponse ) : string | null {
  const action = response.actions?.find( ( a ) => a.name === 'generate-qr-code' )

  return action?.url ?? null
}

/**
 * Extract the deep link redirect URL from the charge response actions.
 */
export function extractDeeplinkUrl( response : QrisChargeResponse ) : string | null {
  const action = response.actions?.find( ( a ) => a.name === 'deeplink-redirect' )

  return action?.url ?? null
}

/**
 * Get the default payment amount from env or fallback.
 */
export function getDefaultAmount() : number {
  const env = process.env.MIDTRANS_PAYMENT_AMOUNT

  return env ? Number.parseInt( env, 10 ) : 15000
}

/**
 * Ensure the server key is configured.
 * Returns null if OK, or an error message.
 */
export function validateConfig() : string | null {
  if ( !MIDTRANS_SERVER_KEY ) {
    return 'MIDTRANS_SERVER_KEY is not configured'
  }

  return null
}
