import 'server-only'

import { db } from '@/lib/db'

let schemaReady: Promise<void> | null = null

export function ensureAuthSchema() {
  schemaReady ??= db.query( `
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS app_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      google_id TEXT UNIQUE,
      avatar_url TEXT,
      password_hash TEXT,
      role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'operator', 'viewer')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );

    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL;

    CREATE TABLE IF NOT EXISTS app_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS app_sessions_user_id_idx ON app_sessions(user_id);
    CREATE INDEX IF NOT EXISTS app_sessions_expires_at_idx ON app_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS app_frames (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      image_key TEXT NOT NULL,
      image_url TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      slots JSONB NOT NULL,
      created_by UUID REFERENCES app_users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_booths (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      location TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      settings JSONB NOT NULL DEFAULT '{"paymentEnabled": false, "disabledFrameKeys": [], "timerEnabled": false, "captureCounterEnabled": false}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE app_booths ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{"paymentEnabled": false, "disabledFrameKeys": [], "timerEnabled": false, "captureCounterEnabled": false}'::jsonb;

    CREATE TABLE IF NOT EXISTS app_media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booth_id UUID NOT NULL REFERENCES app_booths(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS app_media_booth_id_idx ON app_media(booth_id);

    CREATE TABLE IF NOT EXISTS app_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booth_id UUID NOT NULL REFERENCES app_booths(id) ON DELETE CASCADE,
      session_id TEXT,
      media_id UUID REFERENCES app_media(id) ON DELETE CASCADE,
      media_type TEXT CHECK (media_type IN ('strip', 'image', 'mashup', 'countdown', 'loop')),
      frame_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
    );

    CREATE INDEX IF NOT EXISTS app_results_booth_id_idx ON app_results(booth_id);
    CREATE INDEX IF NOT EXISTS app_results_session_id_idx ON app_results(session_id);
    CREATE INDEX IF NOT EXISTS app_results_expires_at_idx ON app_results(expires_at);
  ` ).then( () => undefined )

  return schemaReady
}
