import 'server-only'

import { loadAllFrames } from './config'
import type { ClientFrame } from './frames.client'

export async function getFramesForSsr(): Promise<ClientFrame[]> {
  const frames = await loadAllFrames()

  return frames.map((f) => ({
    key        : f.key,
    label      : f.label,
    publicUrl  : f.publicUrl,
    width      : f.width,
    height     : f.height,
    photoCount : f.slots.length,
    slots      : f.slots,
    builtIn    : f.builtIn,
  }))
}
