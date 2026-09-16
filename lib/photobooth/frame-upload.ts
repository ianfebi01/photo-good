/**
 * Shared rules for the presigned frame upload flow.
 *
 * Three routes cooperate on one upload —
 *   POST /api/frames/presign  → sign a PUT URL
 *   POST /api/frames/preview  → read the uploaded object back, detect slots
 *   POST /api/frames/upload   → read it back again, validate, insert the row
 * — so the folder, size cap and content type live here instead of being
 * repeated (and drifting) in each of them.
 */

import { buildObjectKey } from '@/lib/r2'
import { slugifyKey } from '@/lib/utils'

/** Frames uploaded through the dashboard all land under this prefix. */
export const FRAME_OBJECT_PREFIX = 'frames/user/'

/** Prefixes a frame finalise request may reference. */
export const FRAME_OBJECT_PREFIXES = [FRAME_OBJECT_PREFIX] as const

export const FRAME_MAX_BYTES = 8 * 1024 * 1024 // 8 MB

export const FRAME_CONTENT_TYPE = 'image/png'

export const FRAME_CONTENT_TYPES = new Set( [FRAME_CONTENT_TYPE] )

/** Human-readable size cap for error messages. */
export const FRAME_MAX_MB = Math.round( FRAME_MAX_BYTES / ( 1024 * 1024 ) )

/**
 * Destination key for a new frame upload. The label is optional — the dialog
 * may presign before the admin has typed one — and only ever cosmetic, since
 * uniqueness comes from the timestamp + random suffix.
 */
export function frameObjectKey( label?: string ): string {
  const slug = label ? slugifyKey( label ) : ''

  return buildObjectKey( 'frames/user', {
    slug : slug || undefined,
    ext  : 'png',
  } )
}

/** Logical frame key (`user-<slug>`), unique among all frames. */
export function frameKeyFromLabel( label: string ): string {
  const slug = slugifyKey( label )

  return `user-${slug || 'frame'}`
}
