import 'server-only'

import { db } from '@/lib/db'
import { ensureAuthSchema } from '@/lib/auth/schema'
import type { BoothMediaType } from '@/types/booth'

export type ResultRow = {
  media_type : BoothMediaType
  url : string
  frame_key : string | null
  expires_at : string
  booth_name : string
}

export type SessionResults = {
  sessionId : string
  boothName : string
  results : ResultRow[]
}

export async function getResultsForSsr( sessionId : string ) : Promise<SessionResults | null> {
  await ensureAuthSchema()

  const result = await db.query(
    `SELECT r.media_type, m.url, r.frame_key, r.expires_at,
            b.name AS booth_name
     FROM app_results r
     JOIN app_media m ON r.media_id = m.id
     JOIN app_booths b ON r.booth_id = b.id
     WHERE r.session_id = $1 AND r.expires_at > NOW()
     ORDER BY r.created_at ASC`,
    [sessionId]
  )

  const rows = result.rows as ResultRow[]

  if ( rows.length === 0 ) return null

  return {
    sessionId,
    boothName : rows[0].booth_name,
    results   : rows,
  }
}
