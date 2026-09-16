import 'server-only'

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Readable } from 'node:stream'

const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? 'photobooth-frames'

function getClient(): S3Client {
  // AWS SDK v3.729+ attaches the CRC32 of an EMPTY body to presigned PUT URLs
  // (x-amz-checksum-crc32=AAAAAA==), which does not describe the real payload.
  // R2 tolerates it, stricter S3 implementations reject the upload, and the
  // browser has to send nothing extra either way — so only calculate checksums
  // when an operation actually requires one.
  return new S3Client( {
    region                     : 'auto',
    endpoint                   : R2_ENDPOINT,
    requestChecksumCalculation : 'WHEN_REQUIRED',
    credentials                : {
      accessKeyId     : R2_ACCESS_KEY_ID ?? '',
      secretAccessKey : R2_SECRET_ACCESS_KEY ?? '',
    },
  } )
}

/**
 * Resolve a stored domain-less path (e.g. `/captures/booth-abc.jpg`) to its
 * public URL using `R2_PUBLIC_URL`.
 *
 * Media rows store paths instead of absolute URLs, so a bucket domain change
 * never invalidates them. `scripts/migrate-media-urls.ts` converts old rows.
 */
export function r2PublicUrl( path: string ): string {
  const base = ( R2_PUBLIC_URL ?? '' ).replace( /\/+$/, '' )
  const normalized = path.startsWith( '/' ) ? path : `/${path}`

  return base ? `${base}${normalized}` : normalized
}

/**
 * Upload a buffer directly to R2 from the server.
 */
export async function uploadToR2( {
  key,
  body,
  contentType,
}: {
  key: string
  body: Buffer
  contentType: string
} ): Promise<{ publicUrl: string }> {
  const client = getClient()

  const command = new PutObjectCommand( {
    Bucket      : R2_BUCKET_NAME,
    Key         : key,
    Body        : body,
    ContentType : contentType,
  } )

  await client.send( command )

  let publicUrl = ''
  if ( R2_PUBLIC_URL ) {
    const baseUrl = R2_PUBLIC_URL.replace( /\/$/, '' )

    publicUrl = `${baseUrl}/${key}`
  }

  return { publicUrl }
}

/**
 * How long a presigned PUT stays valid. Long enough for a slow mobile upload
 * of an 8 MB frame, short enough that a leaked URL goes stale quickly.
 */
export const PRESIGN_EXPIRES_SECONDS = 600

/**
 * Create a presigned PUT URL so the browser can upload straight to R2 without
 * the bytes ever passing through this server.
 *
 * The client MUST send the same `Content-Type` that was signed here — R2
 * rejects the request otherwise.
 */
export async function createPresignedPutUrl( {
  key,
  contentType,
  expiresIn = PRESIGN_EXPIRES_SECONDS,
}: {
  key: string
  contentType: string
  expiresIn?: number
} ): Promise<string> {
  const command = new PutObjectCommand( {
    Bucket      : R2_BUCKET_NAME,
    Key         : key,
    ContentType : contentType,
  } )

  return getSignedUrl( getClient(), command, { expiresIn } )
}

/**
 * Read an object's metadata without downloading it. Returns null when the key
 * does not exist (i.e. the client never completed its presigned upload).
 */
export async function headR2Object(
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const head = await getClient().send( new HeadObjectCommand( {
      Bucket : R2_BUCKET_NAME,
      Key    : key,
    } ) )

    return {
      size        : head.ContentLength ?? 0,
      contentType : head.ContentType ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Guard a client-supplied object key before it reaches the S3 API.
 *
 * Only keys inside the given managed prefixes are allowed, so a presigned
 * upload for `frames/user/…` can never be finalised against `captures/…`.
 */
export function isManagedObjectKey( key: unknown, prefixes: readonly string[] ): key is string {
  if ( typeof key !== 'string' || key.length === 0 || key.length > 512 ) return false
  if ( !prefixes.some( ( prefix ) => key.startsWith( prefix ) ) ) return false
  if ( key.endsWith( '/' ) ) return false

  // Relative segments would let a key resolve outside its prefix.
  if ( key.includes( '..' ) || key.includes( '//' ) ) return false

  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test( key )
}

/**
 * Build a collision-proof object key, e.g. `frames/user/summer-day-l8x2k9-3f4a.png`.
 */
export function buildObjectKey(
  folder: string,
  { slug, ext }: { slug?: string; ext: string },
): string {
  const stamp = Date.now().toString( 36 )
  const random = Math.random().toString( 36 ).slice( 2, 8 )
  const name = slug ? `${slug}-${stamp}-${random}` : `${stamp}-${random}`

  return `${folder}/${name}.${ext}`
}

/**
 * Download an object from R2 as a Buffer (uses S3 API — no public access needed).
 */
export async function getR2ObjectBuffer( key: string ): Promise<Buffer> {
  const client = getClient()

  const command = new GetObjectCommand( {
    Bucket : R2_BUCKET_NAME,
    Key    : key,
  } )

  const response = await client.send( command )
  const body = response.Body as Readable

  return new Promise<Buffer>( ( resolve, reject ) => {
    const chunks: Buffer[] = []
    body.on( 'data', ( chunk: Buffer ) => chunks.push( chunk ) )
    body.on( 'end', () => resolve( Buffer.concat( chunks ) ) )
    body.on( 'error', reject )
  } )
}

/**
 * Delete an object from R2.
 */
export async function deleteR2Object( key: string ): Promise<void> {
  const client = getClient()

  const command = new DeleteObjectCommand( {
    Bucket : R2_BUCKET_NAME,
    Key    : key,
  } )

  await client.send( command )
}
