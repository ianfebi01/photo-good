import { type ClientFrame } from './frames.client'

export const FRAMES_QUERY_KEY = ['frames'] as const

export async function getFrames(): Promise<ClientFrame[]> {
  const response = await fetch('/api/frames', { cache: 'no-store' })

  if (!response.ok) {
    throw new Error('Failed to load frames')
  }

  const data = await response.json()
  return Array.isArray(data?.frames) ? data.frames : []
}
