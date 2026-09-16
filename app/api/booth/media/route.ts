import { db } from '@/lib/db'
import { requireBooth } from '@/lib/auth/booth'
import { ensureAuthSchema } from '@/lib/auth/schema'
import {
  MEDIA_MAX_BYTES,
  MEDIA_OBJECT_PREFIXES,
  isMediaMime,
  mimeForObjectKey,
  normalizeMediaMime,
  validateMediaMime,
} from '@/lib/booth/media-upload'
import { headR2Object, isManagedObjectKey, r2PublicUrl } from '@/lib/r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin'  : '*',
  'Access-Control-Allow-Methods' : 'POST, OPTIONS',
  'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
} as const

/**
 * Step 2 of a booth media upload: the bytes are already in R2, so record them.
 *
 * Body (JSON):
 *   - key: the object key returned by POST /api/booth/media/presign
 *
 * The size and MIME type are read back from R2 rather than trusted from the
 * client, so the stored row always describes what actually landed in the
 * bucket. Returns the media row ID for use in result creation.
 */
export async function POST( request : Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  let body : unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error : 'Expected a JSON body' },
      { status : 400, headers : CORS_HEADERS },
    )
  }

  const { key } = ( body ?? {} ) as { key? : unknown }

  if ( !isManagedObjectKey( key, MEDIA_OBJECT_PREFIXES ) ) {
    return Response.json(
      { error : 'Invalid object key' },
      { status : 400, headers : CORS_HEADERS },
    )
  }

  // The object only exists if the client's presigned PUT actually landed.
  const head = await headR2Object( key )
  if ( !head ) {
    return Response.json(
      { error : 'Upload not found — the file did not reach storage' },
      { status : 400, headers : CORS_HEADERS },
    )
  }

  if ( head.size > MEDIA_MAX_BYTES ) {
    return Response.json(
      { error : 'File too large (max 50 MB)' },
      { status : 400, headers : CORS_HEADERS },
    )
  }

  // Prefer what R2 reports. A generic type or none at all falls back to the
  // extension the presign route generated from the declared mime type — R2 does
  // not infer a content type from the extension on its own.
  const reported = head.contentType ? normalizeMediaMime( head.contentType ) : null
  const mime = reported && isMediaMime( reported ) ? reported : mimeForObjectKey( key )

  if ( !mime ) {
    return Response.json(
      { error : 'Upload has no recognizable content type' },
      { status : 400, headers : CORS_HEADERS },
    )
  }

  const mimeError = validateMediaMime( mime )
  if ( mimeError ) {
    return Response.json(
      { error : mimeError },
      { status : 400, headers : CORS_HEADERS },
    )
  }

  const filename = key.slice( key.lastIndexOf( '/' ) + 1 )

  try {
    await ensureAuthSchema()

    // Persist the domain-less path — never the bucket URL — so the media keeps
    // working if the bucket domain changes. The URL is rebuilt on every read.
    const mediaPath = `/${key}`
    const result = await db.query(
      `INSERT INTO app_media (booth_id, filename, url, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, filename, url, mime_type, size_bytes, created_at`,
      [auth.id, filename, mediaPath, mime, head.size]
    )

    // Respond with the absolute URL so existing clients stay unchanged.
    const media = { ...result.rows[0], url : r2PublicUrl( mediaPath ) }

    return Response.json( { media }, { status : 201, headers : CORS_HEADERS } )
  } catch ( err ) {
    // eslint-disable-next-line no-console
    console.error( '[booth/media] Upload failed:', err )

    return Response.json(
      { error : err instanceof Error ? err.message : 'Upload failed' },
      { status : 500, headers : CORS_HEADERS },
    )
  }
}

export async function OPTIONS() {
  return new Response( null, { status : 204, headers : CORS_HEADERS } )
}
