import { db } from '@/lib/db'
import { requireBooth } from '@/lib/auth/booth'
import { ensureAuthSchema } from '@/lib/auth/schema'
import { r2PublicUrl } from '@/lib/r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_TYPES = new Set( ['strip', 'image', 'mashup', 'countdown', 'loop'] )
const FRAME_KEY_RE = /^[a-z0-9-]+$/i

interface Item {
  mediaId : string
  type : string
}

/** POST — link uploaded media files to a session. */
export async function POST( request : Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  let sessionId : string
  let frameKey : string | null = null
  let items : Item[]

  try {
    const body = await request.json()
    sessionId = String( body.sessionId ?? '' ).trim().slice( 0, 32 )
    items = Array.isArray( body.items ) ? body.items : []
    const fk = body.frameKey

    if ( !sessionId ) {
      return Response.json( { error : 'Missing sessionId' }, { status : 400 } )
    }
    if ( items.length === 0 ) {
      return Response.json( { error : 'Missing items array' }, { status : 400 } )
    }
    if ( typeof fk === 'string' && FRAME_KEY_RE.test( fk.trim() ) ) {
      frameKey = fk.trim()
    }
    for ( const item of items ) {
      if ( !item.mediaId || typeof item.mediaId !== 'string' ) {
        return Response.json( { error : 'Each item needs a mediaId' }, { status : 400 } )
      }
      if ( !item.type || !VALID_TYPES.has( item.type ) ) {
        return Response.json( { error : `Invalid type: ${item.type}` }, { status : 400 } )
      }
    }
  } catch {
    // eslint-disable-next-line no-console
    console.error( '[booth/results] Invalid JSON body' )

    return Response.json( { error : 'Invalid JSON body' }, { status : 400 } )
  }

  try {
    await ensureAuthSchema()

    const inserted : Record<string, unknown>[] = []
    for ( const item of items ) {
      const mediaCheck = await db.query(
        'SELECT id FROM app_media WHERE id = $1 AND booth_id = $2',
        [item.mediaId, auth.id]
      )
      if ( mediaCheck.rows.length === 0 ) {
        return Response.json( { error : `Media ${item.mediaId} not found` }, { status : 400 } )
      }

      const result = await db.query(
        `INSERT INTO app_results (booth_id, session_id, media_id, media_type, frame_key)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, booth_id, session_id, media_id, media_type, frame_key, created_at, expires_at`,
        [auth.id, sessionId, item.mediaId, item.type, frameKey]
      )
      inserted.push( result.rows[0] )
    }

    return Response.json(
      {
        sessionId,
        results : inserted,
        booth   : {
          id   : auth.id,
          name : auth.name,
        },
      },
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
    console.error( '[booth/results] Create failed:', err )

    return Response.json(
      { error : err instanceof Error ? err.message : 'Create failed' },
      { status : 500 }
    )
  }
}

export async function OPTIONS() {
  return new Response( null, {
    status  : 204,
    headers : {
      'Access-Control-Allow-Origin'  : '*',
      'Access-Control-Allow-Methods' : 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
    },
  } )
}

/** GET — list results by session ID (public). */
export async function GET( request : Request ) {
  const { searchParams } = new URL( request.url )
  const sessionId = searchParams.get( 'sessionId' )

  if ( !sessionId ) {
    return Response.json( { error : 'Missing sessionId' }, { status : 400 } )
  }

  interface Row {
    id : string
    media_type : string
    url : string
    frame_key : string | null
    created_at : string
    expires_at : string
    booth_name : string
  }

  const result = await db.query(
    `SELECT r.id, r.media_type, m.url, r.frame_key, r.created_at, r.expires_at,
            b.name AS booth_name
     FROM app_results r
     JOIN app_media m ON r.media_id = m.id
     JOIN app_booths b ON r.booth_id = b.id
     WHERE r.session_id = $1 AND r.expires_at > NOW()
     ORDER BY r.created_at ASC`,
    [sessionId]
  )

  const rows = result.rows as Row[]

  if ( rows.length === 0 ) {
    return Response.json( { error : 'Session not found or expired' }, { status : 404 } )
  }

  return Response.json( {
    sessionId,
    boothName : rows[0].booth_name,
    results   : rows.map( ( r ) => ( {
      id        : r.id,
      mediaType : r.media_type,
      // Stored value is the domain-less path; rebuild the URL from it.
      url       : r2PublicUrl( r.url ),
      frameKey  : r.frame_key,
      createdAt : r.created_at,
      expiresAt : r.expires_at,
    } ) ),
  } )
}
