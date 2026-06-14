import sharp from 'sharp'
import fs from 'node:fs/promises'
import { getFrame, validateFrameDimensions } from '@/lib/photobooth/config'
import { getFrameFromDb } from '@/lib/photobooth/frames.db'
import { getR2ObjectBuffer } from '@/lib/r2'
import { detectGreenSlots, clearGreenPixels } from '@/lib/photobooth/slots'
import { getCurrentUser } from '@/lib/auth/session'
import { hasRole } from '@/lib/auth/types'

export const runtime = 'nodejs'

const ALLOWED_TYPES = new Set( ['image/png'] )
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

/**
 * The frame image with its green slot panels turned transparent, so photos
 * placed underneath show through while the surrounding artwork stays on top.
 * This is the same transform compose uses; the booth's live FramePreview
 * overlays it on top of the captured photos.
 */
async function buildTransparentOverlay( buffer: Buffer ): Promise<Buffer | null> {
  const detected = await detectGreenSlots( buffer )
  if ( detected.slots.length === 0 ) {
    return null
  }

  const overlayInfo = await sharp( buffer )
    .ensureAlpha()
    .raw()
    .toBuffer( { resolveWithObject : true } )

  const channels = overlayInfo.info.channels
  const pixels = Buffer.from( overlayInfo.data )
  clearGreenPixels( pixels, overlayInfo.info.width, overlayInfo.info.height, channels )

  return sharp( pixels, {
    raw : { width : overlayInfo.info.width, height : overlayInfo.info.height, channels },
  } )
    .png()
    .toBuffer()
}

async function generatePreviewBuffer( buffer: Buffer ) {
  // Detect slots
  const detected = await detectGreenSlots( buffer )
  if ( detected.slots.length === 0 ) {
    return null
  }

  // Generate transparent-green overlay
  const overlayBuffer = await buildTransparentOverlay( buffer )
  if ( !overlayBuffer ) {
    return null
  }

  // Create solid color blocks for each slot with text
  const colors = [
    { bg : '#EB4C4C', text : '#ffffff' }, // Primary
    { bg : '#FF7070', text : '#ffffff' }, // Coral
    { bg : '#FFA6A6', text : '#3b1515' }, // Accent
    { bg : '#FFEDC7', text : '#3b1515' }, // Secondary
  ]

  const slotComposites = detected.slots.map( ( slot, idx ) => {
    const swatch = colors[idx % colors.length]
    const padding = 8
    const w = slot.width + padding * 2
    const h = slot.height + padding * 2
    const fontSize = Math.max( 12, Math.floor( Math.min( slot.width, slot.height ) * 0.4 ) )

    const svg = Buffer.from(
      `<svg width="${w}" height="${h}">
        <rect width="100%" height="100%" fill="${swatch.bg}" />
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}px" font-weight="bold" fill="${swatch.text}">${idx + 1}</text>
      </svg>`
    )

    return {
      input : svg,
      left  : slot.left - padding,
      top   : slot.top - padding,
    }
  } )

  // Composite background with colored slots, then overlay
  return sharp( {
    create : {
      width      : detected.width,
      height     : detected.height,
      channels   : 4,
      background : { r : 255, g : 255, b : 255, alpha : 1 },
    },
  } )
    .composite( [...slotComposites, { input : overlayBuffer, left : 0, top : 0 }] )
    .png()
    .toBuffer()
}

export async function GET( request: Request ) {
  const { searchParams } = new URL( request.url )
  const key = searchParams.get( 'key' )
  const raw = searchParams.get( 'raw' ) === 'true'
  const overlay = searchParams.get( 'overlay' ) === 'true'

  if ( !key ) {
    return Response.json( { error : 'Missing key parameter' }, { status : 400 } )
  }

  // Resolve frame — getFrame() now checks both filesystem and DB
  const frame = await getFrame( key )

  if ( !frame ) {
    return Response.json( { error : 'Frame not found' }, { status : 404 } )
  }

  try {
    let buffer: Buffer

    if ( frame.image ) {
      // Local filesystem frame (built-in or legacy user-manifest)
      buffer = await fs.readFile( frame.image )
    } else {
      // R2-backed frame — look up the DB record for the object key
      const dbFrame = await getFrameFromDb( key )
      if ( !dbFrame ) {
        return Response.json( { error : 'Frame DB record not found' }, { status : 404 } )
      }
      buffer = await getR2ObjectBuffer( dbFrame.image_key )
    }

    if ( raw ) {
      const contentType = key.endsWith( '.png' ) ? 'image/png' : 'image/jpeg'

      return new Response( new Uint8Array( buffer ), {
        headers : {
          'Content-Type'  : contentType,
          'Cache-Control' : 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      } )
    }

    // Transparent-slot overlay — used by the booth's live FramePreview, which
    // renders captured photos beneath the frame artwork.
    if ( overlay ) {
      const transparent = await buildTransparentOverlay( buffer )
      const body = transparent ?? buffer

      return new Response( new Uint8Array( body ), {
        headers : {
          'Content-Type'  : transparent ? 'image/png' : ( key.endsWith( '.png' ) ? 'image/png' : 'image/jpeg' ),
          'Cache-Control' : 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      } )
    }

    const composed = await generatePreviewBuffer( buffer )

    if ( !composed ) {
      const contentType = key.endsWith( '.png' ) ? 'image/png' : 'image/jpeg'

      return new Response( new Uint8Array( buffer ), {
        headers : {
          'Content-Type'  : contentType,
          'Cache-Control' : 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      } )
    }

    return new Response( new Uint8Array( composed ), {
      headers : {
        'Content-Type'  : 'image/png',
        'Cache-Control' : 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    } )
  } catch ( e ) {
    return Response.json(
      { error : e instanceof Error ? e.message : 'Failed to generate preview' },
      { status : 500 },
    )
  }
}

export async function POST( request: Request ) {
  const user = await getCurrentUser()
  if ( !user || !hasRole( user.role, 'admin' ) ) {
    return Response.json( { error : 'Forbidden' }, { status : 403 } )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json( { error : 'Expected multipart/form-data' }, { status : 400 } )
  }

  const file = form.get( 'file' )
  if ( !( file instanceof File ) ) {
    return Response.json( { error : 'Missing file' }, { status : 400 } )
  }
  if ( !ALLOWED_TYPES.has( file.type ) ) {
    return Response.json(
      { error : 'Unsupported image type' },
      { status : 400 },
    )
  }
  if ( file.size > MAX_BYTES ) {
    return Response.json( { error : 'File too large (max 8 MB)' }, { status : 400 } )
  }

  const buffer = Buffer.from( await file.arrayBuffer() )

  let meta: sharp.Metadata
  try {
    meta = await sharp( buffer ).metadata()
  } catch {
    return Response.json( { error : 'Could not decode image' }, { status : 400 } )
  }
  if ( !meta.width || !meta.height ) {
    return Response.json( { error : 'Image has no dimensions' }, { status : 400 } )
  }

  // Validate 4×6 aspect ratio
  const dimError = validateFrameDimensions( meta.width, meta.height )
  if ( dimError ) {
    return Response.json( { error : dimError }, { status : 400 } )
  }

  // Detect slots for return payload
  const detected = await detectGreenSlots( buffer )

  try {
    const composed = await generatePreviewBuffer( buffer )
    const dataUrl = composed ? `data:image/png;base64,${composed.toString( 'base64' )}` : null

    return Response.json( {
      width      : detected.width,
      height     : detected.height,
      slots      : detected.slots,
      previewUrl : dataUrl,
    } )
  } catch ( e ) {
    return Response.json(
      { error : e instanceof Error ? e.message : 'Failed to generate preview' },
      { status : 500 },
    )
  }
}
