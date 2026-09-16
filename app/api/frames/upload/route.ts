import sharp from 'sharp'

import { getCurrentUser } from '@/lib/auth/session'
import { hasRole } from '@/lib/auth/types'
import { ensureAuthSchema } from '@/lib/auth/schema'
import { BUILT_IN_KEYS, validateFrameDimensions } from '@/lib/photobooth/config'
import { getFrameFromDb, insertFrame } from '@/lib/photobooth/frames.db'
import {
  FRAME_MAX_BYTES,
  FRAME_MAX_MB,
  FRAME_OBJECT_PREFIXES,
  frameKeyFromLabel,
} from '@/lib/photobooth/frame-upload'
import {
  getR2ObjectBuffer,
  headR2Object,
  isManagedObjectKey,
  r2PublicUrl,
} from '@/lib/r2'

export const runtime = 'nodejs'

const MAX_SLOTS = 8

type Slot = { left: number; top: number; width: number; height: number }

/**
 * Validate the slot geometry the client derived from the slot-detection step.
 * Returns an error string instead of throwing so the route reads linearly.
 */
function parseSlots( value: unknown ): Slot[] | string {
  if ( !Array.isArray( value ) ) return 'Missing slots'
  if ( value.length === 0 || value.length > MAX_SLOTS ) {
    return `Invalid slots (1-${MAX_SLOTS} required)`
  }

  const slots: Slot[] = []

  for ( const raw of value ) {
    const source = ( raw ?? {} ) as Record<string, unknown>
    const [ left, top, width, height ] = ( [ 'left', 'top', 'width', 'height' ] as const ).map(
      ( field ) => Number( source[field] ),
    )

    if ( ![ left, top, width, height ].every( Number.isFinite ) ) {
      return 'Invalid slot geometry'
    }
    if ( width <= 0 || height <= 0 || left < 0 || top < 0 ) {
      return 'Invalid slot geometry'
    }

    slots.push( {
      left   : Math.round( left ),
      top    : Math.round( top ),
      width  : Math.round( width ),
      height : Math.round( height ),
    } )
  }

  return slots
}

/**
 * Step 3 of the frame upload: the PNG is already in R2, so validate the stored
 * object and record it. Body (JSON):
 *   - key:   the object key returned by /api/frames/presign
 *   - label: human-readable name
 *   - slots: slot rectangles detected in the preview step
 */
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

  const { key, label, slots: slotsRaw } = ( body ?? {} ) as {
    key?: unknown
    label?: unknown
    slots?: unknown
  }

  const labelRaw = typeof label === 'string' ? label.trim() : ''

  if ( !isManagedObjectKey( key, FRAME_OBJECT_PREFIXES ) ) {
    return Response.json( { error : 'Invalid object key' }, { status : 400 } )
  }
  if ( !labelRaw ) {
    return Response.json( { error : 'Missing label' }, { status : 400 } )
  }
  if ( labelRaw.length > 60 ) {
    return Response.json( { error : 'Label too long (max 60 chars)' }, { status : 400 } )
  }

  const slots = parseSlots( slotsRaw )
  if ( typeof slots === 'string' ) {
    return Response.json( { error : slots }, { status : 400 } )
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

  // Validate actual image dimensions match 4×6 aspect ratio
  let meta: sharp.Metadata
  try {
    meta = await sharp( buffer ).metadata()
  } catch {
    return Response.json( { error : 'Could not decode image' }, { status : 400 } )
  }
  if ( !meta.width || !meta.height ) {
    return Response.json( { error : 'Image has no dimensions' }, { status : 400 } )
  }

  const dimError = validateFrameDimensions( meta.width, meta.height )
  if ( dimError ) {
    return Response.json( { error : dimError }, { status : 400 } )
  }

  // Slots come from the client, so keep them inside the artwork they belong to.
  const outOfBounds = slots.findIndex( ( slot ) =>
    slot.left + slot.width > meta.width! || slot.top + slot.height > meta.height!,
  )
  if ( outOfBounds !== -1 ) {
    return Response.json(
      { error : `Slot ${outOfBounds + 1} falls outside the frame` },
      { status : 400 },
    )
  }

  // Ensure DB table exists before the uniqueness probe below
  await ensureAuthSchema()

  // app_frames.key is the primary key — find a key that is still free.
  const baseKey = frameKeyFromLabel( labelRaw )
  let frameKey = baseKey
  let suffix = 2
  while ( BUILT_IN_KEYS.has( frameKey ) || ( await getFrameFromDb( frameKey ) ) ) {
    frameKey = `${baseKey}-${suffix++}`
  }

  // Save to DB with the R2 object key and public URL
  const frame = await insertFrame( {
    key        : frameKey,
    label      : labelRaw,
    image_key  : key,
    image_url  : r2PublicUrl( key ),
    width      : meta.width,
    height     : meta.height,
    slots,
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
}