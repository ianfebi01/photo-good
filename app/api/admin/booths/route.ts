import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { hasRole } from '@/lib/auth/types'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkAdmin() {
  const user = await getCurrentUser()
  if ( !user || !hasRole( user.role, 'admin' ) ) {
    return Response.json( { error : 'Forbidden' }, { status : 403 } )
  }
  
  return null
}

/** GET — List all booths */
export async function GET() {
  const forbidden = await checkAdmin()
  if ( forbidden ) return forbidden
  const result = await db.query( 'SELECT id, name, location, active, created_at, updated_at FROM app_booths ORDER BY created_at DESC' )
  
  return Response.json( { booths : result.rows } )
}

/** POST — Create a booth */
export async function POST( request: Request ) {
  const forbidden = await checkAdmin()
  if ( forbidden ) return forbidden
  let name = ''; let location: string | null = null
  try {
    const body = await request.json(); name = String( body.name ?? '' ).trim(); if ( typeof body.location === 'string' ) location = body.location.trim() || null 
  } catch {
    return Response.json( { error : 'Invalid JSON' }, { status : 400 } ) 
  }
  if ( !name || name.length < 2 ) return Response.json( { error : 'Name required (min 2 chars)' }, { status : 400 } )
  const apiKey = `pb_${crypto.randomBytes( 24 ).toString( 'hex' )}`
  try {
    const result = await db.query( 'INSERT INTO app_booths (name, api_key, location) VALUES ($1, $2, $3) RETURNING id, name, api_key, location, active, created_at, updated_at', [name, apiKey, location] )
    
    return Response.json( { booth : result.rows[0] }, { status : 201 } )
  } catch ( err ) {
    return Response.json( { error : err instanceof Error ? err.message : 'Create failed' }, { status : 500 } ) 
  }
}
