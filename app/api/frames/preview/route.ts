import sharp from 'sharp'
import { detectGreenSlots, isGreen } from '@/lib/photobooth/slots'

export const runtime = 'nodejs'

const ALLOWED_TYPES = new Set( ['image/png', 'image/jpeg', 'image/webp'] )
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

export async function POST( request: Request ) {
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

  // Detect slots
  const detected = await detectGreenSlots( buffer )
  if ( detected.slots.length === 0 ) {
    return Response.json( { width : detected.width, height : detected.height, slots : [] } )
  }

  // Generate transparent-green overlay
  const overlayInfo = await sharp( buffer )
    .ensureAlpha()
    .raw()
    .toBuffer( { resolveWithObject : true } )

  const channels = overlayInfo.info.channels
  const pixels = Buffer.from( overlayInfo.data )
  for ( let i = 0; i < pixels.length; i += channels ) {
    if ( isGreen( pixels[i], pixels[i + 1], pixels[i + 2] ) ) {
      pixels[i + 3] = 0 // Make transparent
    }
  }

  const overlayBuffer = await sharp( pixels, {
    raw : { width : overlayInfo.info.width, height : overlayInfo.info.height, channels },
  } )
    .png()
    .toBuffer()

  // Create solid color blocks for each slot with text
  const colors = [
    { bg : '#EB4C4C', text : '#ffffff' }, // Primary
    { bg : '#FF7070', text : '#ffffff' }, // Coral
    { bg : '#FFA6A6', text : '#3b1515' }, // Accent
    { bg : '#FFEDC7', text : '#3b1515' }, // Secondary
  ]

  const slotComposites = detected.slots.map( ( slot, idx ) => {
    const swatch = colors[idx % colors.length]
    const fontSize = Math.max( 12, Math.floor( Math.min( slot.width, slot.height ) * 0.4 ) )

    const svg = Buffer.from(
      `<svg width="${slot.width}" height="${slot.height}">
        <rect width="100%" height="100%" fill="${swatch.bg}" />
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}px" font-weight="bold" fill="${swatch.text}">${idx + 1}</text>
      </svg>`
    )

    return {
      input : svg,
      left  : slot.left,
      top   : slot.top,
    }
  } )

  // Composite background with colored slots, then overlay
  const composed = await sharp( {
    create : {
      width      : detected.width,
      height     : detected.height,
      channels   : 4,
      background : { r : 255, g : 255, b : 255, alpha : 1 },
    },
  } )
    .composite( [...slotComposites, { input : overlayBuffer, left : 0, top : 0 }] )
    .jpeg( { quality : 90 } )
    .toBuffer()

  const dataUrl = `data:image/jpeg;base64,${composed.toString( 'base64' )}`

  return Response.json( {
    width      : detected.width,
    height     : detected.height,
    slots      : detected.slots,
    previewUrl : dataUrl,
  } )
}
