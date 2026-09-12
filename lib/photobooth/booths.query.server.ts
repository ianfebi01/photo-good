import 'server-only'

import { db } from '@/lib/db'
import { ensureAuthSchema } from '@/lib/auth/schema'
import { normalizeBoothSettings } from './booth-settings'
import type { Booth } from './booths.query'

export async function getBoothsForSsr() : Promise<Booth[]> {
  await ensureAuthSchema()
  const result = await db.query(
    'SELECT id, name, location, active, settings, created_at, updated_at FROM app_booths ORDER BY created_at DESC'
  )

  return ( result.rows as Booth[] ).map( ( booth ) => ( {
    ...booth,
    settings : normalizeBoothSettings( booth.settings ),
  } ) )
}

export async function getBoothForSsr( id : string ) : Promise<Booth | null> {
  await ensureAuthSchema()
  const result = await db.query(
    'SELECT id, name, location, active, settings, created_at, updated_at FROM app_booths WHERE id = $1',
    [id]
  )

  const booth = result.rows[0] as Booth | undefined
  if ( !booth ) return null

  return { ...booth, settings : normalizeBoothSettings( booth.settings ) }
}
