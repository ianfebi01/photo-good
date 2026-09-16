import sharp from 'sharp'
import fs from 'node:fs/promises'
import { getFrame, validateFrameDimensions } from '@/lib/photobooth/config'
import { getFrameFromDb } from '@/lib/photobooth/frames.db'
import {
  FRAME_MAX_BYTES,
  FRAME_MAX_MB,
  FRAME_OBJECT_PREFIXES,
} from '@/lib/photobooth/frame-upload'
import {
  deleteR2Object,
  getR2ObjectBuffer,
  headR2Object,
  isManagedObjectKey,
  r2PublicUrl,
} from '@/lib/r2'
import { detectGreenSlots, clearGreenPixels } from '@/lib/photobooth/slots'
import { getCurrentUser } from '@/lib/auth/session'
import { hasRole } from '@/lib/auth/types'

export const runtime = 'nodejs'

// Composed previews are only ever rendered as small thumbnails (frame pickers,
// dashboard grid), while the frame artwork itself is 1200×3600+ — so serve a
// downscaled PNG instead. Callers may override the width with `?w=`.
const DEFAULT_PREVIEW_WIDTH = 480
const MIN_PREVIEW_WIDTH = 64
const MAX_PREVIEW_WIDTH = 1600

/**
 * Width of the composer preview returned by POST — the dialog shows it in a
 * ~400px column, so a 720px PNG is plenty and keeps the base64 payload tiny.
 */
const PREVIEW_RESPONSE_WIDTH = 720

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

  const requestedWidth = Number.parseInt( searchParams.get( 'w' ) ?? '', 10 )
  const previewWidth = Number.isFinite( requestedWidth )
    ? Math.min( Math.max( requestedWidth, MIN_PREVIEW_WIDTH ), MAX_PREVIEW_WIDTH )
    : DEFAULT_PREVIEW_WIDTH

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

    // The composite is built at native frame size, but these previews are only
    // ever shown as small thumbnails — downscale before sending.
    const thumbnail = await sharp( composed )
      .resize( { width : previewWidth, withoutEnlargement : true } )
      .png()
      .toBuffer()

    return new Response( new Uint8Array( thumbnail ), {
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

/**
 * Discard an uploaded object that can never become a saved frame (wrong
 * format, wrong aspect ratio, no slots) — otherwise the browser's direct upload
 * leaves an orphan in the bucket, since nothing else references it.
 *
 * Deleting is best-effort: the surrounding response stays the same either way.
 */
async function discardUnusableUpload( key: string ) {
  await deleteR2Object( key ).catch( () => {
    // Already gone, or the key is being retried — the error is not actionable.
  } )
}

export async function POST( request: Request ) {
  const user = await getCurrentUser()
  if ( !user || !hasRole( user.role, 'admin' ) ) {
    return Response.json( { error : 'Forbidden' }, { status : 403 } )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json( { error : 'Expected a JSON body' }, { status : 400 } )
  }

  const { key } = ( body ?? {} ) as { key?: unknown }
  if ( !isManagedObjectKey( key, FRAME_OBJECT_PREFIXES ) ) {
    return Response.json( { error : 'Invalid object key' }, { status : 400 } )
  }

  // The object only exists if the browser's presigned PUT actually landed.
  const head = await headR2Object( key )
  if ( !head ) {
    return Response.json(
      { error : 'Upload not found — the file did not reach storage' },
      { status : 400 },
    )
  }
  if ( head.size > FRAME_MAX_BYTES ) {
    await discardUnusableUpload( key )

    return Response.json(
      { error : `File too large (max ${FRAME_MAX_MB} MB)` },
      { status : 400 },
    )
  }

  let buffer: Buffer
  try {
    buffer = await getR2ObjectBuffer( key )
  } catch {
    return Response.json( { error : 'Could not read the uploaded frame' }, { status : 400 } )
  }

  let meta: sharp.Metadata
  try {
    meta = await sharp( buffer ).metadata()
  } catch {
    await discardUnusableUpload( key )

    return Response.json( { error : 'Could not decode image' }, { status : 400 } )
  }
  if ( !meta.width || !meta.height ) {
    await discardUnusableUpload( key )

    return Response.json( { error : 'Image has no dimensions' }, { status : 400 } )
  }

  // Validate 4×6 aspect ratio
  const dimError = validateFrameDimensions( meta.width, meta.height )
  if ( dimError ) {
    await discardUnusableUpload( key )

    return Response.json( { error : dimError }, { status : 400 } )
  }

  // Detect slots for return payload
  const detected = await detectGreenSlots( buffer )

  // No slots means the upload can never be saved — drop it instead of leaving
  // an object behind. The empty `slots` payload is the same as before.
  if ( detected.slots.length === 0 ) {
    await discardUnusableUpload( key )
  }

  try {
    const composed = await generatePreviewBuffer( buffer )

    // The composite is built at native frame size (1200×1800+); only ever shown
    // as a thumbnail in the dialog, so downscale before base64ing it into JSON.
    const thumbnail = composed
      ? await sharp( composed )
        .resize( { width : PREVIEW_RESPONSE_WIDTH, withoutEnlargement : true } )
        .png()
        .toBuffer()
      : null

    const dataUrl = thumbnail ? `data:image/png;base64,${thumbnail.toString( 'base64' )}` : null

    return Response.json( {
      width      : detected.width,
      height     : detected.height,
      slots      : detected.slots,
      previewUrl : dataUrl,
      key,
      publicUrl  : r2PublicUrl( key ),
    } )
  } catch ( e ) {
    return Response.json(
      { error : e instanceof Error ? e.message : 'Failed to generate preview' },
      { status : 500 },
    )
  }
}
