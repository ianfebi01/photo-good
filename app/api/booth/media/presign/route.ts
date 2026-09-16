import { requireBooth } from '@/lib/auth/booth'
import {
  MEDIA_MAX_BYTES,
  boothMediaObject,
  normalizeMediaMime,
  validateMediaMime,
} from '@/lib/booth/media-upload'
import { PRESIGN_EXPIRES_SECONDS, createPresignedPutUrl, r2PublicUrl } from '@/lib/r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin'  : '*',
  'Access-Control-Allow-Methods' : 'POST, OPTIONS',
  'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
} as const

/**
 * Step 1 of a booth media upload: exchange the booth API key for a short-lived
 * PUT URL, so images and clips go straight from the booth to R2 instead of
 * through this server.
 *
 * Body (JSON):
 *   - mimeType:     the type the client will send (image/* or video/*, no webm)
 *   - size:         optional byte count, rejected up front when over the cap
 *   - filename:     optional original name, only used to guess an extension
 *
 * Returns the `key` the client must send to POST /api/booth/media to create the
 * media row once the PUT succeeds.
 */
export async function POST( request: Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error : 'Expected a JSON body' },
      { status : 400, headers : CORS_HEADERS },
    )
  }

  const { mimeType, size, filename } = ( body ?? {} ) as {
    mimeType?: unknown
    size?: unknown
    filename?: unknown
  }

  const mimeError = validateMediaMime( mimeType )
  if ( mimeError ) {
    return Response.json( { error : mimeError }, { status : 400, headers : CORS_HEADERS } )
  }

  if ( size !== undefined && size !== null ) {
    if ( typeof size !== 'number' || !Number.isFinite( size ) || size <= 0 ) {
      return Response.json(
        { error : 'Invalid size' },
        { status : 400, headers : CORS_HEADERS },
      )
    }
    if ( size > MEDIA_MAX_BYTES ) {
      return Response.json(
        { error : 'File too large (max 50 MB)' },
        { status : 400, headers : CORS_HEADERS },
      )
    }
  }

  const mime = normalizeMediaMime( mimeType as string )
  const originalName = typeof filename === 'string' ? filename : ''
  const { filename : storedName, key } = boothMediaObject( {
    boothId : auth.id,
    mime,
    originalName,
  } )

  const uploadUrl = await createPresignedPutUrl( { key, contentType : mime } )

  return Response.json(
    {
      uploadUrl,
      key,
      filename    : storedName,
      mediaPath   : `/${key}`,
      publicUrl   : r2PublicUrl( key ),
      // Signed into the URL — the client must send this exact header.
      contentType : mime,
      expiresIn   : PRESIGN_EXPIRES_SECONDS,
    },
    { headers : CORS_HEADERS },
  )
}

export async function OPTIONS() {
  return new Response( null, { status : 204, headers : CORS_HEADERS } )
}
