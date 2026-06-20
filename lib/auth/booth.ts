import { db } from '@/lib/db'

export type BoothAuth = {
  id : string
  name : string
  location : string | null
}

/**
 * Authenticate a booth client via Bearer token or x-booth-key header.
 * Returns the booth record if valid, or null.
 */
export async function authenticateBooth( request : Request ) : Promise<BoothAuth | null> {
  const authHeader = request.headers.get( 'authorization' )
  const boothKey = request.headers.get( 'x-booth-key' )

  let token : string | null = null

  if ( authHeader?.startsWith( 'Bearer ' ) ) {
    token = authHeader.slice( 7 )
  } else if ( boothKey ) {
    token = boothKey
  }

  if ( !token ) return null

  try {
    const result = await db.query(
      'SELECT id, name, location FROM app_booths WHERE api_key = $1 AND active = true',
      [token]
    )
    if ( result.rows.length === 0 ) return null
    
    return result.rows[0] as BoothAuth
  } catch ( err ) {
    // eslint-disable-next-line no-console
    console.error( '[booth/auth] DB lookup failed:', err )

    return null
  }
}

/**
 * Require booth auth — returns a 401 JSON response if not authenticated.
 * Returns the booth record if valid.
 */
export async function requireBooth( request : Request ) : Promise<BoothAuth | Response> {
  const booth = await authenticateBooth( request )
  if ( !booth ) {
    return Response.json( { error : 'Unauthorized — invalid or inactive booth API key' }, { status : 401 } )
  }
  
  return booth
}
