import { BUILT_IN_KEYS } from '@/lib/photobooth/config'
import { getAllFramesFromDb } from '@/lib/photobooth/frames.db'
import { ensureAuthSchema } from '@/lib/auth/schema'
import { requireBooth } from '@/lib/auth/booth'
import { isFrameEnabledForBooth } from '@/lib/photobooth/booth-settings'
import { getBoothSettingsForBooth } from '@/lib/photobooth/booth-settings.server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET( request : Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  try {
    await ensureAuthSchema()

    const dbFrames = await getAllFramesFromDb()

    const frames = [
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

    // Only expose the frames the admin enabled for this booth.
    const settings = await getBoothSettingsForBooth( auth.id )
    const allowedFrames = frames.filter( ( f ) => isFrameEnabledForBooth( settings, f.key ) )

    return Response.json(
      { frames : allowedFrames },
      {
        headers : {
          'Access-Control-Allow-Origin'  : '*',
          'Access-Control-Allow-Methods' : 'GET, OPTIONS',
          'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
        },
      }
    )
  } catch ( err ) {
    // eslint-disable-next-line no-console
    console.error( '[booth/frames] Failed:', err )

    return Response.json(
      { error : err instanceof Error ? err.message : 'Failed to load frames' },
      { status : 500 }
    )
  }
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
