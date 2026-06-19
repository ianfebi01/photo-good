import { loadAllFrames, BUILT_IN_KEYS } from '@/lib/photobooth/config'
import { getAllFramesFromDb } from '@/lib/photobooth/frames.db'
import { ensureAuthSchema } from '@/lib/auth/schema'
import { requireBooth } from '@/lib/auth/booth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET( request : Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  await ensureAuthSchema()

  const fsFrames = await loadAllFrames()
  const dbFrames = await getAllFramesFromDb()
  const dbFrameKeys = new Set( dbFrames.map( ( f ) => f.key ) )

  const frames = [
    // Filesystem frames (legacy user uploads not yet in DB)
    ...fsFrames
      .filter( ( f ) => !f.builtIn && !dbFrameKeys.has( f.key ) )
      .map( ( f ) => ( {
        key      : f.key,
        label    : f.label,
        imageUrl : f.publicUrl,
        width    : f.width,
        height   : f.height,
        slots    : f.slots,
        builtIn  : f.builtIn,
      } ) ),
    // DB frames (includes built-in and custom)
    ...dbFrames.map( ( f ) => ( {
      key      : f.key,
      label    : f.label,
      imageUrl : f.image_url,
      width    : f.width,
      height   : f.height,
      slots    : f.slots,
      builtIn  : BUILT_IN_KEYS.has( f.key ),
    } ) ),
  ]

  return Response.json(
    { frames },
    {
      headers : {
        'Access-Control-Allow-Origin'  : '*',
        'Access-Control-Allow-Methods' : 'GET, OPTIONS',
        'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
      },
    }
  )
}

export async function OPTIONS() {
  return new Response( null, {
    status  : 204,
    headers : {
      'Access-Control-Allow-Origin'  : '*',
      'Access-Control-Allow-Methods' : 'GET, OPTIONS',
      'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
    },
  } )
}
