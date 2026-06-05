import 'server-only'

import { loadAllFrames } from './config'
import type { ClientFrame } from './frames.client'
import type { FramesResponse, PageArg } from './frames.query'

export async function getFramesForSsr( { page, limit }: PageArg ): Promise<FramesResponse> {
  const all = await loadAllFrames()
  const total = all.length
  const start = ( page - 1 ) * limit
  const pageFrames = all.slice( start, start + limit )

  const frames: ClientFrame[] = pageFrames.map( ( f ) => ( {
    key        : f.key,
    label      : f.label,
    publicUrl  : f.publicUrl,
    width      : f.width,
    height     : f.height,
    photoCount : f.slots.length,
    slots      : f.slots,
    builtIn    : f.builtIn,
  } ) )

  return { frames, total }
}
