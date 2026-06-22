import sharp from 'sharp'

import { getCurrentUser } from '@/lib/auth/session'
import { hasRole } from '@/lib/auth/types'
import { ensureAuthSchema } from '@/lib/auth/schema'
import { BUILT_IN_KEYS, validateFrameDimensions } from '@/lib/photobooth/config'
import { insertFrame } from '@/lib/photobooth/frames.db'
import { uploadToR2 } from '@/lib/r2'
import { slugifyKey } from '@/lib/utils'

export const runtime = 'nodejs'

const ALLOWED_TYPES = new Set( ['image/png'] )
const MAX_BYTES = 8 * 1024 * 1024

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
  const labelRaw = String( form.get( 'label' ) ?? '' ).trim()
  const slotsRaw = String( form.get( 'slots' ) ?? '' )

  if ( !( file instanceof File ) ) {
    return Response.json( { error : 'Missing file' }, { status : 400 } )
  }
  if ( !labelRaw ) {
    return Response.json( { error : 'Missing label' }, { status : 400 } )
  }
  if ( labelRaw.length > 60 ) {
    return Response.json( { error : 'Label too long (max 60 chars)' }, { status : 400 } )
  }
  if ( !ALLOWED_TYPES.has( file.type ) ) {
    return Response.json( { error : 'Unsupported image type (use PNG)' }, { status : 400 } )
  }
  if ( file.size > MAX_BYTES ) {
    return Response.json( { error : 'File too large (max 8 MB)' }, { status : 400 } )
  }

  let slots: Array<{ left: number; top: number; width: number; height: number }>
  try {
    slots = JSON.parse( slotsRaw )
  } catch {
    return Response.json( { error : 'Invalid slots JSON' }, { status : 400 } )
  }

  if ( !Array.isArray( slots ) || slots.length === 0 || slots.length > 8 ) {
    return Response.json( { error : 'Invalid slots (1-8 required)' }, { status : 400 } )
  }

  const buffer = Buffer.from( await file.arrayBuffer() )

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

  const width = meta.width
  const height = meta.height

  const baseSlug = slugifyKey( labelRaw )
  const key = `user-${baseSlug}`

  if ( BUILT_IN_KEYS.has( key ) ) {
    return Response.json( { error : 'Key conflicts with built-in frame' }, { status : 409 } )
  }

  // Upload to R2 so frame images are accessible from any deployment
  const imageKey = `frames/user/${key}-${Date.now()}.png`
  const { publicUrl } = await uploadToR2( {
    key         : imageKey,
    body        : buffer,
    contentType : 'image/png',
  } )

  // Ensure DB table exists
  await ensureAuthSchema()

  // Save to DB with R2 object key and public URL
  const frame = await insertFrame( {
    key,
    label      : labelRaw,
    image_key  : imageKey,
    image_url  : publicUrl,
    width,
    height,
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

