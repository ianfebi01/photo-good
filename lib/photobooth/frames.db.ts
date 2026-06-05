import { db } from '@/lib/db'
import type { FrameSlot } from '@/lib/photobooth/frames.query'

export type DbFrame = {
  key: string
  label: string
  image_key: string
  image_url: string
  width: number
  height: number
  slots: FrameSlot[]
  created_by: string | null
  created_at: Date
}

export async function insertFrame( frame: {
  key: string
  label: string
  image_key: string
  image_url: string
  width: number
  height: number
  slots: FrameSlot[]
  created_by: string | null
} ): Promise<DbFrame> {
  const result = await db.query(
    `INSERT INTO app_frames (key, label, image_key, image_url, width, height, slots, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     RETURNING *`,
    [
      frame.key,
      frame.label,
      frame.image_key,
      frame.image_url,
      frame.width,
      frame.height,
      JSON.stringify( frame.slots ),
      frame.created_by,
    ],
  )

  return result.rows[0] as DbFrame
}

export async function getAllFramesFromDb(): Promise<DbFrame[]> {
  const result = await db.query(
    'SELECT * FROM app_frames ORDER BY created_at DESC',
  )

  return result.rows as DbFrame[]
}

export async function getFrameFromDb( key: string ): Promise<DbFrame | null> {
  const result = await db.query(
    'SELECT * FROM app_frames WHERE key = $1',
    [key],
  )

  return ( result.rows[0] as DbFrame ) ?? null
}

export async function deleteFrameFromDb( key: string ): Promise<DbFrame | null> {
  const result = await db.query(
    'DELETE FROM app_frames WHERE key = $1 RETURNING *',
    [key],
  )

  return ( result.rows[0] as DbFrame ) ?? null
}
