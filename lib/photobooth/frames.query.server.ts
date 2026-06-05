import 'server-only'

import { loadAllFrames, BUILT_IN_KEYS } from './config'
import { getAllFramesFromDb } from './frames.db'
import { ensureAuthSchema } from '@/lib/auth/schema'
import type { ClientFrame } from './frames.client'
import type { FramesResponse, PageArg } from './frames.query'

export async function getFramesForSsr( { page, limit }: PageArg ): Promise<FramesResponse> {
  const fsFrames = await loadAllFrames()
  await ensureAuthSchema()
  const dbFrames = await getAllFramesFromDb()

  const dbFrameKeys = new Set( dbFrames.map( ( f ) => f.key ) )

  const all: ClientFrame[] = [
    // Only legacy user-manifest frames from filesystem — built-in frames come from DB
    ...fsFrames
      .filter( ( f ) => !f.builtIn && !dbFrameKeys.has( f.key ) )
      .map( ( f ) => ( {
        key        : f.key,
        label      : f.label,
        publicUrl  : f.publicUrl,
        width      : f.width,
        height     : f.height,
        photoCount : f.slots.length,
        slots      : f.slots,
        builtIn    : f.builtIn,
      } ) ),
    ...dbFrames.map( ( f ) => ( {
      key        : f.key,
      label      : f.label,
      publicUrl  : f.image_url,
      width      : f.width,
      height     : f.height,
      photoCount : f.slots.length,
      slots      : f.slots as ClientFrame['slots'],
      builtIn    : BUILT_IN_KEYS.has( f.key ),
    } ) ),
  ]

  const total = all.length
  const start = ( page - 1 ) * limit

  return { frames : all.slice( start, start + limit ), total }
}
