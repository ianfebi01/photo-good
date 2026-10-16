import 'server-only'

import { db } from '@/lib/db'
import { ensurePaymentSchema } from '@/lib/payment/schema'
import type { PaymentRow } from '@/lib/payment/schema'
import * as doku from '@/lib/payment/doku'
import * as midtrans from '@/lib/payment/midtrans'

export type PaymentGateway = 'doku' | 'midtrans'

/**
 * Determine which payment gateway to use.
 * Checks PAYMENT_GATEWAY env var ('doku' | 'midtrans').
 * Defaults to 'doku' if DOKU_CLIENT_ID is configured, otherwise 'midtrans'.
 */
export function getActiveGateway() : PaymentGateway {
  const explicit = process.env.PAYMENT_GATEWAY?.toLowerCase().trim()
  if ( explicit === 'doku' || explicit === 'midtrans' ) {
    return explicit
  }

  return process.env.DOKU_CLIENT_ID ? 'doku' : 'midtrans'
}

/**
 * Validate configuration of the active gateway.
 */
export function validatePaymentConfig() : string | null {
  const gateway = getActiveGateway()

  return gateway === 'doku'
    ? doku.validateConfig()
    : midtrans.validateConfig()
}

/**
 * Get the default payment amount in IDR.
 */
export function getDefaultPaymentAmount() : number {
  const gateway = getActiveGateway()

  return gateway === 'doku'
    ? doku.getDefaultAmount()
    : midtrans.getDefaultAmount()
}

export interface PaymentChargeResult {
  orderId : string
  transactionId : string | null
  transactionStatus : string
  qrCodeUrl : string | null
  deeplinkUrl : string | null
  grossAmount : number
  paymentType : string
  gateway : PaymentGateway
  expiryTime? : string | null
}

/**
 * Create a QRIS payment charge using the active gateway.
 */
export async function createPaymentCharge( params : {
  boothId : string
  sessionId : string
  grossAmount? : number
} ) : Promise<PaymentChargeResult> {
  await ensurePaymentSchema()

  const gateway = getActiveGateway()
  const grossAmount = params.grossAmount && params.grossAmount > 0
    ? params.grossAmount
    : getDefaultPaymentAmount()

  if ( gateway === 'doku' ) {
    const orderId = doku.generateOrderId( params.boothId )
    const expiryMinutes = process.env.DOKU_QRIS_EXPIRY_MINUTES
      ? Number.parseInt( process.env.DOKU_QRIS_EXPIRY_MINUTES, 10 )
      : 15
    const validityPeriod = new Date( Date.now() + expiryMinutes * 60 * 1000 )
      .toISOString()
      .replace( /\.\d{3}Z$/, '+00:00' )

    const response = await doku.createDokuQrisCharge( {
      partnerReferenceNo : orderId,
      grossAmount,
      validityPeriod,
    } )

    const qrCodeUrl = await doku.extractQrCodeUrl( response.qrContent )
    const transactionId = response.referenceNo || null
    const transactionStatus = 'pending'
    const paymentType = 'qris'
    const expiryTime = response.additionalInfo?.validityPeriod ?? validityPeriod

    await db.query(
      `INSERT INTO app_payments
       (booth_id, order_id, transaction_id, session_id, gross_amount,
        payment_type, transaction_status, qr_code_url, deeplink_url, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        params.boothId,
        orderId,
        transactionId,
        params.sessionId,
        grossAmount,
        paymentType,
        transactionStatus,
        qrCodeUrl,
        null,
        JSON.stringify( response ),
      ],
    )

    return {
      orderId,
      transactionId,
      transactionStatus,
      qrCodeUrl,
      deeplinkUrl : null,
      grossAmount,
      paymentType,
      gateway,
      expiryTime,
    }
  }

  // Midtrans flow
  const orderId = midtrans.generateOrderId( params.boothId )
  const response = await midtrans.createQrisCharge( {
    payment_type        : 'gopay',
    transaction_details : {
      order_id     : orderId,
      gross_amount : grossAmount,
    },
  } )

  const qrCodeUrl = midtrans.extractQrCodeUrl( response )
  const deeplinkUrl = midtrans.extractDeeplinkUrl( response )
  const transactionId = response.transaction_id || null
  const transactionStatus = response.transaction_status
  const paymentType = response.payment_type

  await db.query(
    `INSERT INTO app_payments
     (booth_id, order_id, transaction_id, session_id, gross_amount,
      payment_type, transaction_status, qr_code_url, deeplink_url, raw_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      params.boothId,
      orderId,
      transactionId,
      params.sessionId,
      grossAmount,
      paymentType,
      transactionStatus,
      qrCodeUrl,
      deeplinkUrl,
      JSON.stringify( response ),
    ],
  )

  return {
    orderId,
    transactionId,
    transactionStatus,
    qrCodeUrl,
    deeplinkUrl,
    grossAmount,
    paymentType,
    gateway,
  }
}

export interface PaymentStatusResult {
  orderId : string
  transactionId : string | null
  transactionStatus : string
  grossAmount : number
  paymentType : string
  qrCodeUrl? : string | null
  settlementTime? : string | null
  expiryTime? : string | null
}

/**
 * Query current payment status from the authoritative gateway and sync DB.
 */
export async function getPaymentStatus(
  orderId : string,
  boothId : string,
) : Promise<PaymentStatusResult> {
  await ensurePaymentSchema()

  // First check what we have in DB to know which gateway handled this payment
  const existing = await db.query(
    'SELECT * FROM app_payments WHERE order_id = $1 AND booth_id = $2 LIMIT 1',
    [orderId, boothId],
  )

  if ( existing.rows.length === 0 ) {
    throw new Error( 'Order not found' )
  }

  const payment = existing.rows[0] as PaymentRow
  const isDoku = payment.payment_type === 'qris'
    || ( payment.raw_response && 'qrContent' in payment.raw_response )

  if ( isDoku ) {
    const referenceNo = payment.transaction_id ?? ''
    const status = await doku.getDokuTransactionStatus( referenceNo, orderId )
    const normalizedStatus = doku.normalizeDokuStatus( status.latestTransactionStatus )

    const raw = payment.raw_response as Record<string, unknown> | null
    const rawAddl = raw?.additionalInfo as Record<string, unknown> | undefined
    const expiryTime = ( typeof rawAddl?.validityPeriod === 'string'
      ? rawAddl.validityPeriod
      : null ) ?? null

    await db.query(
      `UPDATE app_payments
       SET transaction_status = $1, updated_at = NOW()
       WHERE order_id = $2 AND booth_id = $3`,
      [normalizedStatus, orderId, boothId],
    )

    return {
      orderId           : status.originalPartnerReferenceNo || orderId,
      transactionId     : status.originalReferenceNo || payment.transaction_id,
      transactionStatus : normalizedStatus,
      grossAmount       : payment.gross_amount,
      paymentType       : 'qris',
      qrCodeUrl         : payment.qr_code_url,
      settlementTime    : status.paidTime ?? null,
      expiryTime,
    }
  }

  // Midtrans status check
  const status = await midtrans.getTransactionStatus( orderId )

  await db.query(
    `UPDATE app_payments
     SET transaction_status = $1, updated_at = NOW()
     WHERE order_id = $2 AND booth_id = $3`,
    [status.transaction_status, orderId, boothId],
  )

  return {
    orderId           : status.order_id,
    transactionId     : status.transaction_id,
    transactionStatus : status.transaction_status,
    grossAmount       : Number.parseFloat( status.gross_amount ) || payment.gross_amount,
    paymentType       : status.payment_type,
    settlementTime    : status.settlement_time ?? null,
    expiryTime        : status.expiry_time ?? null,
  }
}

export { doku, midtrans }
