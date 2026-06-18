import 'server-only'

import { db } from '@/lib/db'
import { ensureAuthSchema } from '@/lib/auth/schema'
import type { Booth } from './booths.query'

export async function getBoothsForSsr() : Promise<Booth[]> {
  await ensureAuthSchema()
  const result = await db.query(
    'SELECT id, name, location, active, created_at, updated_at FROM app_booths ORDER BY created_at DESC'
  )
  return result.rows as Booth[]
}
