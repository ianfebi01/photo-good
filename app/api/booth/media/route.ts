import { db } from '@/lib/db'
import { requireBooth } from '@/lib/auth/booth'
import { ensureAuthSchema } from '@/lib/auth/schema'
import { r2PublicUrl, uploadToR2 } from '@/lib/r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

/** Canonical extension per mime type — the format the bytes actually are. */
const EXT_BY_MIME : Record<string, string> = {
  'image/jpeg'      : '.jpg',
  'image/png'       : '.png',
  'image/webp'      : '.webp',
  'image/gif'       : '.gif',
  'image/heic'      : '.heic',
  'video/mp4'       : '.mp4',
  'video/quicktime' : '.mov',
  'video/webm'      : '.webm',
}

/**
 * Extension for a stored upload.
 *
 * The mime type wins, because the uploaded filename can lie (and the booth
 * sends names like `countdown-abc-0.mp4` that we must not trust blindly).
 * Only when the mime is unknown do we fall back to the original filename's
 * extension, then to a format-appropriate default. Previously every video was
 * stored as `.webm`, which mislabelled MP4 uploads while their `mime_type`
 * still said `video/mp4`.
 */
function extensionFor( mime : string, originalName : string ) : string {
  const normalized = mime.toLowerCase().split( ';' )[0].trim()
  const known = EXT_BY_MIME[normalized]
  if ( known ) return known

  const fromName = /\.([a-z0-9]{2,4})$/i.exec( originalName )?.[1]
  if ( fromName ) return `.${fromName.toLowerCase()}`

  return normalized.startsWith( 'video/' ) ? '.mp4' : '.jpg'
}

/** POST — upload a single media file. Returns the media row ID for use in result creation. */
export async function POST( request : Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  let buffer : Buffer
  let mime : string
  let uploadedName = ''

  try {
    const form = await request.formData()
    const file = form.get( 'file' )

    if ( !file || !( file instanceof Blob ) ) {
      return Response.json( { error : 'Missing file field' }, { status : 400 } )
    }
    if ( file.size > MAX_BYTES ) {
      return Response.json( { error : 'File too large (max 10 MB)' }, { status : 400 } )
    }
    if ( !file.type.startsWith( 'image/' ) && !file.type.startsWith( 'video/' ) ) {
      return Response.json( { error : 'File must be an image or video' }, { status : 400 } )
    }

    mime = file.type
    uploadedName = file instanceof File ? file.name : ''
    buffer = Buffer.from( await file.arrayBuffer() )
  } catch {
    // eslint-disable-next-line no-console
    console.error( '[booth/media] Invalid form data' )

    return Response.json( { error : 'Invalid form data' }, { status : 400 } )
  }

  const boothShort = auth.id.replace( /-/g, '' ).slice( 0, 12 )
  const ts = Date.now()
  const ext = extensionFor( mime, uploadedName )
  const filename = `booth-${boothShort}-${ts}${ext}`

  try {
    await ensureAuthSchema()

    // Upload directly to R2 under 'captures/' folder
    const key = `captures/${filename}`
    await uploadToR2( {
      key,
      body        : buffer,
      contentType : mime,
    } )

    // Persist the domain-less path — never the bucket URL — so the media keeps
    // working if the bucket domain changes. The URL is rebuilt on every read.
    const mediaPath = `/${key}`
    const result = await db.query(
      `INSERT INTO app_media (booth_id, filename, url, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, filename, url, mime_type, size_bytes, created_at`,
      [auth.id, filename, mediaPath, mime, buffer.length]
    )

    // Respond with the absolute URL so existing clients stay unchanged.
    const media = { ...result.rows[0], url : r2PublicUrl( mediaPath ) }

    return Response.json(
      { media },
      {
        status  : 201,
        headers : {
          'Access-Control-Allow-Origin'  : '*',
          'Access-Control-Allow-Methods' : 'POST, OPTIONS',
          'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
        },
      }
    )
  } catch ( err ) {
    // eslint-disable-next-line no-console
    console.error( '[booth/media] Upload failed:', err )

    return Response.json(
      { error : err instanceof Error ? err.message : 'Upload failed' },
      { status : 500 }
    )
  }
}

export async function OPTIONS() {
  return new Response( null, {
    status  : 204,
    headers : {
      'Access-Control-Allow-Origin'  : '*',
      'Access-Control-Allow-Methods' : 'POST, OPTIONS',
      'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
    },
  } )
}
