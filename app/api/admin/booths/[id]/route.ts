import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { hasRole } from '@/lib/auth/types'
import { pickBoothSettings, type BoothClientSettings } from '@/lib/photobooth/booth-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function checkAdmin() {
  const user = await getCurrentUser(); if ( !user || !hasRole( user.role, 'admin' ) ) return Response.json( { error : 'Forbidden' }, { status : 403 } ); 

  return null 
}

export async function GET( _req: Request, ctx: RouteContext<'/api/admin/booths/[id]'> ) {
  const f = await checkAdmin(); if ( f ) return f
  const { id } = await ctx.params; if ( !UUID_RE.test( id ) ) return Response.json( { error : 'Invalid ID' }, { status : 400 } )
  const r = await db.query( 'SELECT id, name, location, active, settings, created_at, updated_at FROM app_booths WHERE id=$1', [id] )
  if ( !r.rows.length ) return Response.json( { error : 'Not found' }, { status : 404 } )
  
  return Response.json( { booth : r.rows[0] } )
}

export async function PATCH( request: Request, ctx: RouteContext<'/api/admin/booths/[id]'> ) {
  const f = await checkAdmin(); if ( f ) return f
  const { id } = await ctx.params; if ( !UUID_RE.test( id ) ) return Response.json( { error : 'Invalid ID' }, { status : 400 } )
  let name: string | undefined, location: string | null | undefined, active: boolean | undefined
  let settings: Partial<BoothClientSettings> | undefined
  try {
    const body = await request.json(); if ( typeof body.name === 'string' ) name = body.name.trim(); if ( body.location !== undefined ) location = typeof body.location === 'string' ? body.location.trim() : null; if ( typeof body.active === 'boolean' ) active = body.active; if ( body.settings !== undefined ) {
      const picked = pickBoothSettings( body.settings ); if ( Object.keys( picked ).length ) settings = picked 
    }
  } catch {
    return Response.json( { error : 'Invalid JSON' }, { status : 400 } ) 
  }
  if ( name !== undefined && name.length < 2 ) {
    return Response.json( { error : 'Name required (min 2 chars)' }, { status : 400 } ) 
  }
  const sets: string[] = []; const vals: ( string | boolean | null )[] = []; let i = 1
  if ( name !== undefined ) {
    sets.push( `name=$${i++}` ); vals.push( name ) 
  }
  if ( location !== undefined ) {
    sets.push( `location=$${i++}` ); vals.push( location ) 
  }
  if ( active !== undefined ) {
    sets.push( `active=$${i++}` ); vals.push( active ) 
  }
  if ( settings ) {
    sets.push( `settings = settings || $${i++}::jsonb` ); vals.push( JSON.stringify( settings ) ) 
  }
  if ( !sets.length ) return Response.json( { error : 'No fields' }, { status : 400 } )
  sets.push( 'updated_at=NOW()' ); vals.push( id )
  const r = await db.query( `UPDATE app_booths SET ${sets.join( ',' )} WHERE id=$${i} RETURNING id,name,location,active,settings,created_at,updated_at`, vals )
  if ( !r.rows.length ) return Response.json( { error : 'Not found' }, { status : 404 } )
  
  return Response.json( { booth : r.rows[0] } )
}

export async function DELETE( _req: Request, ctx: RouteContext<'/api/admin/booths/[id]'> ) {
  const f = await checkAdmin(); if ( f ) return f
  const { id } = await ctx.params; if ( !UUID_RE.test( id ) ) return Response.json( { error : 'Invalid ID' }, { status : 400 } )
  const r = await db.query( 'DELETE FROM app_booths WHERE id=$1 RETURNING id', [id] )
  if ( !r.rows.length ) return Response.json( { error : 'Not found' }, { status : 404 } )
  
  return Response.json( { deleted : true } )
}
