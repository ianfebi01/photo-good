import { requireBooth } from '@/lib/auth/booth'
import { ensureAuthSchema } from '@/lib/auth/schema'
import { getBoothSettingsForBooth } from '@/lib/photobooth/booth-settings.server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin'  : '*',
  'Access-Control-Allow-Methods' : 'GET, OPTIONS',
  'Access-Control-Allow-Headers' : 'Authorization, Content-Type, x-booth-key',
}

/**
 * GET — Return the client settings for the authenticated booth.
 *
 * The booth client calls this on startup to decide which steps to render
 * (payment, frame selection, countdown timer, capture counter).
 *
 * Returns:
 *   { settings : BoothClientSettings }
 */
export async function GET( request : Request ) {
  const auth = await requireBooth( request )
  if ( auth instanceof Response ) return auth

  try {
    await ensureAuthSchema()

    const settings = await getBoothSettingsForBooth( auth.id )

    return Response.json( { settings }, { headers : CORS_HEADERS } )
  } catch ( err ) {
    // eslint-disable-next-line no-console
    console.error( '[booth/settings] Failed:', err )

    return Response.json(
      { error : err instanceof Error ? err.message : 'Failed to load settings' },
      { status : 500, headers : CORS_HEADERS },
    )
  }
}

export async function OPTIONS() {
  return new Response( null, { status : 204, headers : CORS_HEADERS } )
}
