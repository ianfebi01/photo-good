import 'server-only'

import { db } from '@/lib/db'
import { normalizeBoothSettings, type BoothClientSettings } from './booth-settings'

/**
 * Load the normalized settings for a booth.
 *
 * Callers must ensure the auth schema exists first (e.g. via `ensureAuthSchema`).
 */
export async function getBoothSettingsForBooth( boothId : string ) : Promise<BoothClientSettings> {
  const result = await db.query( 'SELECT settings FROM app_booths WHERE id = $1', [boothId] )

  return normalizeBoothSettings( result.rows[0]?.settings )
}
