import { db } from '@/lib/db'
import { requireBooth } from '@/lib/auth/booth'
import { ensureAuthSchema } from '@/lib/auth/schema'
import { uploadToR2 } from '@/lib/r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

/** POST — upload a single media file. Returns the media row ID for use in result creation. */
export async function POST( request : Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  let buffer : Buffer
  let mime : string

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
    buffer = Buffer.from( await file.arrayBuffer() )
  } catch {
    // eslint-disable-next-line no-console
    console.error( '[booth/media] Invalid form data' )

    return Response.json( { error : 'Invalid form data' }, { status : 400 } )
  }

  const boothShort = auth.id.replace( /-/g, '' ).slice( 0, 12 )
  const ts = Date.now()
  const ext = mime.startsWith( 'video/' ) ? '.webm' : '.jpg'
  const filename = `booth-${boothShort}-${ts}${ext}`

  try {
    await ensureAuthSchema()

    // Upload directly to R2 under 'captures/' folder
    const key = `captures/${filename}`
    const { publicUrl } = await uploadToR2( {
      key,
      body        : buffer,
      contentType : mime,
    } )

    const url = publicUrl
    const result = await db.query(
      `INSERT INTO app_media (booth_id, filename, url, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, filename, url, mime_type, size_bytes, created_at`,
      [auth.id, filename, url, mime, buffer.length]
    )

    return Response.json(
      { media : result.rows[0] },
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
