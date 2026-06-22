import 'server-only'

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'

const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? 'photobooth-frames'

function getClient(): S3Client {
  return new S3Client( {
    region      : 'auto',
    endpoint    : R2_ENDPOINT,
    credentials : {
      accessKeyId     : R2_ACCESS_KEY_ID ?? '',
      secretAccessKey : R2_SECRET_ACCESS_KEY ?? '',
    },
  } )
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
