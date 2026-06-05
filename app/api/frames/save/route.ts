import { getCurrentUser } from '@/lib/auth/session'
import { hasRole } from '@/lib/auth/types'
import { insertFrame } from '@/lib/photobooth/frames.db'
import { BUILT_IN_KEYS } from '@/lib/photobooth/config'

export async function POST( request: Request ) {
  const user = await getCurrentUser()
  if ( !user || !hasRole( user.role, 'admin' ) ) {
    return Response.json( { error : 'Forbidden' }, { status : 403 } )
  }

  let body: {
    key: string
    label: string
    image_key: string
    image_url: string
    width: number
    height: number
    slots: Array<{ left: number; top: number; width: number; height: number }>
  }

  try {
    body = await request.json()
  } catch {
    return Response.json( { error : 'Invalid JSON body' }, { status : 400 } )
  }

  if ( !body.key || !body.label || !body.image_key || !body.image_url ) {
    return Response.json( { error : 'Missing required fields' }, { status : 400 } )
  }

  if ( BUILT_IN_KEYS.has( body.key ) ) {
    return Response.json( { error : 'Key conflicts with built-in frame' }, { status : 409 } )
  }

  if ( body.label.length > 60 ) {
    return Response.json( { error : 'Label too long (max 60 chars)' }, { status : 400 } )
  }

  if ( !Array.isArray( body.slots ) || body.slots.length === 0 || body.slots.length > 8 ) {
    return Response.json( { error : 'Invalid slots (1-8 required)' }, { status : 400 } )
  }

  if ( !body.width || !body.height ) {
    return Response.json( { error : 'Invalid dimensions' }, { status : 400 } )
  }

  try {
    const frame = await insertFrame( {
      key        : body.key,
      label      : body.label,
      image_key  : body.image_key,
      image_url  : body.image_url,
      width      : body.width,
      height     : body.height,
      slots      : body.slots,
      created_by : user.id,
    } )

    return Response.json( {
      frame : {
        key        : frame.key,
        label      : frame.label,
        publicUrl  : frame.image_url,
        width      : frame.width,
        height     : frame.height,
        photoCount : frame.slots.length,
        slots      : frame.slots,
        builtIn    : false,
      },
    } )
  } catch ( error ) {
    const message = error instanceof Error ? error.message : 'Failed to save frame'
    
    return Response.json( { error : message }, { status : 500 } )
  }
}
