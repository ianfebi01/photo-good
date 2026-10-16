import 'server-only'

import * as crypto from 'node:crypto'
import QRCode from 'qrcode'

// ── Configuration ────────────────────────────────────────────────

const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID ?? ''
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY ?? ''
const DOKU_PRIVATE_KEY = process.env.DOKU_PRIVATE_KEY ?? ''
const DOKU_MERCHANT_ID = process.env.DOKU_MERCHANT_ID ?? ''
const DOKU_TERMINAL_ID = process.env.DOKU_TERMINAL_ID ?? 'A01'

// DOKU doesn't have sandbox for QRIS — default to production
const BASE_URL = process.env.DOKU_BASE_URL ?? 'https://api.doku.com'

// ── Token cache ──────────────────────────────────────────────────

let cachedToken : { accessToken : string; expiresAt : number } | null = null

// ── Signature helpers ────────────────────────────────────────────

/**
 * Normalise the private key to standard PEM format.
 * Handles escaped newlines (`\n`) from .env files and missing PEM headers.
 */
function getPrivateKey() : string {
  let key = DOKU_PRIVATE_KEY.trim()
  if ( key.includes( '\\n' ) ) {
    key = key.replace( /\\n/g, '\n' )
  }
  if ( !key.includes( '-----BEGIN' ) && key.length > 0 ) {
    key = `-----BEGIN RSA PRIVATE KEY-----\n${key}\n-----END RSA PRIVATE KEY-----`
  }

  return key
}

/**
 * ISO-8601 timestamp for DOKU headers.
 * Format: YYYY-MM-DDTHH:mm:ssZD  (e.g. 2024-03-26T16:01:41+07:00)
 */
function dokuTimestamp() : string {
  return new Date().toISOString().replace( /\.\d{3}Z$/, '+00:00' )
}

/**
 * Generate an asymmetric signature for the Get Token B2B endpoint.
 *
 * stringToSign = clientId + "|" + timestamp
 * signature = SHA256withRSA( privateKey, stringToSign )  →  base64
 */
function generateAsymmetricSignature( timestamp : string ) : string {
  const stringToSign = `${DOKU_CLIENT_ID}|${timestamp}`

  const sign = crypto.createSign( 'SHA256' )
  sign.update( stringToSign )
  sign.end()

  return sign.sign( getPrivateKey(), 'base64' )
}

/**
 * Generate a symmetric signature for transactional SNAP endpoints.
 *
 * stringToSign = HTTPMethod + ":" + endpointUrl + ":" + accessToken
 *              + ":" + Lowercase(HexEncode(SHA-256(minify(body)))) + ":" + timestamp
 * signature = HMAC_SHA512( secretKey, stringToSign )  →  base64
 */
function generateSymmetricSignature(
  httpMethod : string,
  endpointUrl : string,
  accessToken : string,
  body : string,
  timestamp : string,
) : string {
  const bodyHash = crypto
    .createHash( 'sha256' )
    .update( body )
    .digest( 'hex' )
    .toLowerCase()

  const stringToSign = `${httpMethod}:${endpointUrl}:${accessToken}:${bodyHash}:${timestamp}`

  return crypto
    .createHmac( 'sha512', DOKU_SECRET_KEY )
    .update( stringToSign )
    .digest( 'base64' )
}

/**
 * Numeric external ID — unique per day.
 * Uses timestamp + random digits.
 */
function generateExternalId() : string {
  const ts = Date.now().toString()
  const rand = Math.floor( Math.random() * 100000 ).toString().padStart( 5, '0' )

  return `${ts}${rand}`
}

// ── Get Token B2B ────────────────────────────────────────────────

interface DokuTokenResponse {
  responseCode : string
  responseMessage : string
  accessToken : string
  tokenType : string
  expiresIn : string
}

/**
 * Get a B2B access token from DOKU using asymmetric signature.
 * Tokens are cached in-memory and refreshed 60s before expiry.
 */
async function getAccessToken() : Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if ( cachedToken && Date.now() < cachedToken.expiresAt ) {
    return cachedToken.accessToken
  }

  const timestamp = dokuTimestamp()
  const signature = generateAsymmetricSignature( timestamp )

  const res = await fetch( `${BASE_URL}/authorization/v1/access-token/b2b`, {
    method  : 'POST',
    headers : {
      'Content-Type' : 'application/json',
      'X-TIMESTAMP'  : timestamp,
      'X-CLIENT-KEY' : DOKU_CLIENT_ID,
      'X-SIGNATURE'  : signature,
    },
    body : JSON.stringify( { grantType : 'client_credentials' } ),
  } )

  const data = await res.json() as Record<string, unknown>

  if ( !res.ok || !data.accessToken ) {
    throw new Error(
      `DOKU Get Token failed [${res.status}]: ${JSON.stringify( data )}`,
    )
  }

  const tokenData = data as unknown as DokuTokenResponse
  const expiresInMs = ( Number.parseInt( tokenData.expiresIn, 10 ) || 900 ) * 1000

  cachedToken = {
    accessToken : tokenData.accessToken,
    expiresAt   : Date.now() + expiresInMs - 60_000, // 60s buffer
  }

  return cachedToken.accessToken
}

// ── Common SNAP request ──────────────────────────────────────────

async function dokuSnapRequest<T>(
  endpointPath : string,
  body : object,
) : Promise<T> {
  const accessToken = await getAccessToken()
  const timestamp = dokuTimestamp()
  const bodyStr = JSON.stringify( body )

  const signature = generateSymmetricSignature(
    'POST',
    endpointPath,
    accessToken,
    bodyStr,
    timestamp,
  )

  const res = await fetch( `${BASE_URL}${endpointPath}`, {
    method  : 'POST',
    headers : {
      'Content-Type'  : 'application/json',
      'Authorization' : `Bearer ${accessToken}`,
      'X-TIMESTAMP'   : timestamp,
      'X-SIGNATURE'   : signature,
      'X-PARTNER-ID'  : DOKU_CLIENT_ID,
      'X-EXTERNAL-ID' : generateExternalId(),
      'CHANNEL-ID'    : 'H2H',
    },
    body : bodyStr,
  } )

  const data = await res.json() as Record<string, unknown>

  if ( !res.ok ) {
    throw new Error(
      `DOKU SNAP [${endpointPath}] failed [${res.status}]: ${JSON.stringify( data )}`,
    )
  }

  return data as unknown as T
}

// ── Types ─────────────────────────────────────────────────────────

export interface DokuQrisGenerateRequest {
  partnerReferenceNo : string
  amount : {
    value : string    // e.g. "15000.00"
    currency : string // "IDR"
  }
  merchantId : string
  terminalId : string
  validityPeriod? : string // ISO 8601 — defaults to 30 days
  additionalInfo : {
    postalCode : string
    feeType : string  // "1" = No Tips
  }
}

export interface DokuQrisGenerateResponse {
  responseCode : string
  responseMessage : string
  referenceNo : string
  partnerReferenceNo : string
  qrContent : string
  terminalId : string
  additionalInfo? : {
    validityPeriod? : string
    postalCode? : string
    feeType? : string
  }
}

export interface DokuQrisQueryRequest {
  originalReferenceNo : string
  originalPartnerReferenceNo : string
  serviceCode : string // "47"
  merchantId : string
}

export interface DokuQrisQueryResponse {
  responseCode : string
  responseMessage : string
  originalReferenceNo : string
  originalPartnerReferenceNo : string
  serviceCode : string
  latestTransactionStatus : string
  transactionStatusDesc : string
  paidTime? : string
  amount? : {
    value : string
    currency : string
  }
  feeAmount? : {
    value : string
    currency : string
  }
  additionalInfo? : {
    approvalCode? : string
    convenienceFee? : string
    issuerId? : string
    issuerName? : string
    terminalId? : string
    customerName? : string
  }
}

export interface DokuQrisCancelRequest {
  partnerReferenceNo : string
  referenceNo : string
  merchantId : string
  reason? : string
}

export interface DokuQrisCancelResponse {
  responseCode : string
  responseMessage : string
  partnerReferenceNo : string
  referenceNo : string
  expiredDate? : string
}

// ── API Methods ───────────────────────────────────────────────────

const GENERATE_PATH = '/snap-adapter/b2b/v1.0/qr/qr-mpm-generate'
const QUERY_PATH = '/snap-adapter/b2b/v1.0/qr/qr-mpm-query'
const CANCEL_PATH = '/snap-adapter/b2b/v1.0/qr/qr-expire'

/**
 * Generate a QRIS code via DOKU SNAP API.
 * Returns the response containing `qrContent` — the raw QR string to render.
 */
export async function createDokuQrisCharge(
  params : {
    partnerReferenceNo : string
    grossAmount : number
    postalCode? : string
    validityPeriod? : string
  },
) : Promise<DokuQrisGenerateResponse> {
  const body : DokuQrisGenerateRequest = {
    partnerReferenceNo : params.partnerReferenceNo,
    amount             : {
      value    : `${params.grossAmount}.00`,
      currency : 'IDR',
    },
    merchantId     : DOKU_MERCHANT_ID,
    terminalId     : DOKU_TERMINAL_ID,
    additionalInfo : {
      postalCode : params.postalCode ?? '10120',
      feeType    : '1', // No Tips
    },
  }

  if ( params.validityPeriod ) {
    body.validityPeriod = params.validityPeriod
  }

  return dokuSnapRequest<DokuQrisGenerateResponse>( GENERATE_PATH, body as unknown as Record<string, unknown> )
}

/**
 * Query the status of a DOKU QRIS transaction.
 */
export async function getDokuTransactionStatus(
  originalReferenceNo : string,
  partnerReferenceNo : string,
) : Promise<DokuQrisQueryResponse> {
  const body : DokuQrisQueryRequest = {
    originalReferenceNo,
    originalPartnerReferenceNo : partnerReferenceNo,
    serviceCode                : '47',
    merchantId                 : DOKU_MERCHANT_ID,
  }

  return dokuSnapRequest<DokuQrisQueryResponse>( QUERY_PATH, body as unknown as Record<string, unknown> )
}

/**
 * Cancel (expire) a DOKU QRIS code so it can no longer be paid.
 */
export async function cancelDokuTransaction(
  referenceNo : string,
  partnerReferenceNo : string,
  reason? : string,
) : Promise<DokuQrisCancelResponse> {
  const body : DokuQrisCancelRequest = {
    partnerReferenceNo,
    referenceNo,
    merchantId : DOKU_MERCHANT_ID,
  }

  if ( reason ) {
    body.reason = reason
  }

  return dokuSnapRequest<DokuQrisCancelResponse>( CANCEL_PATH, body as unknown as Record<string, unknown> )
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
 * Map DOKU latestTransactionStatus to a normalised status string
 * compatible with the existing app_payments table.
 *
 * DOKU statuses: "00" = success, "06" = pending, etc.
 */
export function normalizeDokuStatus( status : string ) : string {
  switch ( status ) {
  case '00':
    return 'settlement'
  case '01':
  case '02':
  case '03':
    return 'pending'
  case '04':
    return 'refund'
  case '05':
    return 'cancel'
  case '06':
    return 'expire'
  default:
    return 'pending'
  }
}

/**
 * Ensure the DOKU credentials are configured.
 * Returns null if OK, or an error message.
 */
export function validateConfig() : string | null {
  if ( !DOKU_CLIENT_ID ) {
    return 'DOKU_CLIENT_ID is not configured'
  }

  if ( !DOKU_SECRET_KEY ) {
    return 'DOKU_SECRET_KEY is not configured'
  }

  if ( !DOKU_PRIVATE_KEY ) {
    return 'DOKU_PRIVATE_KEY is not configured'
  }

  if ( !DOKU_MERCHANT_ID ) {
    return 'DOKU_MERCHANT_ID is not configured'
  }

  return null
}

/**
 * Generate a QR code image as a Base64 Data URL from the raw QR string.
 * This can be stored in `qr_code_url` so booth clients can render it directly.
 */
export async function extractQrCodeUrl( qrContent : string ) : Promise<string> {
  return QRCode.toDataURL( qrContent, {
    errorCorrectionLevel : 'M',
    margin               : 2,
    width                : 300,
  } )
}

// ── Webhook / Notification ────────────────────────────────────────

export interface DokuQrisNotifyRequest {
  originalPartnerReferenceNo : string
  originalReferenceNo : string
  latestTransactionStatus : string
  transactionStatusDesc : string
  amount? : {
    value : string
    currency : string
  }
  additionalInfo? : Record<string, unknown>
}

export interface DokuQrisNotifyResponse {
  responseCode : string
  responseMessage : string
}

/**
 * Build the standard SNAP QR MPM Notify success response.
 */
export function buildNotifySuccessResponse() : DokuQrisNotifyResponse {
  return {
    responseCode    : '2002400',
    responseMessage : 'Successful',
  }
}
