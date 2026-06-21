import 'server-only'

import { db } from '@/lib/db'

let schemaReady : Promise<void> | null = null

export function ensurePaymentSchema() {
  if ( !schemaReady ) {
    schemaReady = db.query( `
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- Preserve old DOKU-style table if it exists, then create the Midtrans schema fresh.
    -- Safe to run repeatedly — DO block handles the renames only once.
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_payments' AND column_name = 'invoice_number'
      ) THEN
        ALTER TABLE app_payments RENAME TO app_payments_old;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS app_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booth_id UUID NOT NULL,
      order_id TEXT NOT NULL UNIQUE,
      transaction_id TEXT,
      session_id TEXT NOT NULL,
      gross_amount INTEGER NOT NULL,
      payment_type TEXT NOT NULL DEFAULT 'gopay',
      transaction_status TEXT NOT NULL DEFAULT 'pending',
      qr_code_url TEXT,
      deeplink_url TEXT,
      raw_response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS app_payments_order_id_idx
      ON app_payments(order_id);
    CREATE INDEX IF NOT EXISTS app_payments_booth_id_idx
      ON app_payments(booth_id);
    CREATE INDEX IF NOT EXISTS app_payments_session_id_idx
      ON app_payments(session_id);
    CREATE INDEX IF NOT EXISTS app_payments_status_idx
      ON app_payments(transaction_status);
  ` ).then( () => undefined )
      .catch( ( err ) => {
        schemaReady = null
        throw err
      } )
  }

  return schemaReady
}

export interface PaymentRow {
  id : string
  booth_id : string
  order_id : string
  transaction_id : string | null
  session_id : string
  gross_amount : number
  payment_type : string
  transaction_status : string
  qr_code_url : string | null
  deeplink_url : string | null
  raw_response : Record<string, unknown> | null
  created_at : string
  updated_at : string
}
