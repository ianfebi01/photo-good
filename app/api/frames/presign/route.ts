import { getCurrentUser } from '@/lib/auth/session'
import { hasRole } from '@/lib/auth/types'
import {
  FRAME_CONTENT_TYPE,
  FRAME_CONTENT_TYPES,
  FRAME_MAX_BYTES,
  FRAME_MAX_MB,
  frameObjectKey,
} from '@/lib/photobooth/frame-upload'
import { PRESIGN_EXPIRES_SECONDS, createPresignedPutUrl, r2PublicUrl } from '@/lib/r2'

export const runtime = 'nodejs'

/**
 * Step 1 of the frame upload: hand an authenticated admin a short-lived URL to
 * PUT the PNG to directly, so an 8 MB file never transits this server.
 *
 * Body (JSON):
 *   - contentType: the MIME type the browser will send (must be image/png)
 *   - size:        optional byte count, rejected up front when over the cap
 *   - label:       optional frame name, used only to make the key readable
 *
 * Returns the `key`/`mediaPath` the client must send to /api/frames/preview
 * and /api/frames/upload once the PUT succeeds.
 */
export async function POST( request: Request ) {
  const user = await getCurrentUser()
  if ( !user || !hasRole( user.role, 'admin' ) ) {
    return Response.json( { error : 'Forbidden' }, { status : 403 } )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json( { error : 'Expected a JSON body' }, { status : 400 } )
  }

  const { contentType, size, label } = ( body ?? {} ) as {
    contentType?: unknown
    size?: unknown
    label?: unknown
  }

  if ( typeof contentType !== 'string' || !FRAME_CONTENT_TYPES.has( contentType ) ) {
    return Response.json(
      { error : 'Unsupported image type (use PNG)' },
      { status : 400 },
    )
  }

  if ( size !== undefined && size !== null ) {
    if ( typeof size !== 'number' || !Number.isFinite( size ) || size <= 0 ) {
      return Response.json( { error : 'Invalid size' }, { status : 400 } )
    }
    if ( size > FRAME_MAX_BYTES ) {
      return Response.json(
        { error : `File too large (max ${FRAME_MAX_MB} MB)` },
        { status : 400 },
      )
    }
  }

  const labelRaw = typeof label === 'string' ? label.trim() : ''
  if ( labelRaw.length > 60 ) {
    return Response.json( { error : 'Label too long (max 60 chars)' }, { status : 400 } )
  }

  const key = frameObjectKey( labelRaw )
  const uploadUrl = await createPresignedPutUrl( {
    key,
    contentType : FRAME_CONTENT_TYPE,
  } )

  return Response.json( {
    uploadUrl,
    key,
    mediaPath   : `/${key}`,
    publicUrl   : r2PublicUrl( key ),
    // Signed into the URL — the browser must send this exact header.
    contentType : FRAME_CONTENT_TYPE,
    expiresIn   : PRESIGN_EXPIRES_SECONDS,
  } )
}
