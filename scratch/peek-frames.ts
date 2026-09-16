import path from 'node:path'
import { Pool } from 'pg'
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const db = new Pool({ connectionString: process.env.POSTGRES_URL })

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

const run = async () => {
  const res = await db.query(
    'SELECT key, label, image_key, slots, width, height FROM app_frames ORDER BY created_at DESC',
  )
  for (const row of res.rows) {
    console.log('=== ' + row.key + ' | ' + row.label + ' | ' + row.width + 'x' + row.height)
    console.log(JSON.stringify(row.slots))
  }
  await db.end()

  const list = await s3.send(
    new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: 'frames/',
      MaxKeys: 30,
    }),
  )
  console.log('\n--- bucket objects (frames/) ---')
  console.log((list.Contents ?? []).map((o) => `${o.Key}  ${o.Size}`).join('\n'))

  for (const key of [
    'frames/user/user-pass-foto-1789220402198.png',
    'frames/user/user-test-v6-1782141645966.png',
    'frames/user/user-test-v4-1782121680524.png',
  ]) {
    try {
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
      )
      console.log('HEAD ok', key, head.ContentLength, head.ContentType)
    } catch (e) {
      console.log('HEAD fail', key, (e as Error).message)
    }
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
