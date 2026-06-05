import type { ClientFrame } from './frames.client'
import type { Status } from '@/store/boothStore'

export const FRAMES_QUERY_KEY = ['frames'] as const
export const CAMERA_STATUS_QUERY_KEY = ['camera-status'] as const

export type FrameSlot = {
  left: number
  top: number
  width: number
  height: number
}

async function parseJson<T>( response: Response, fallbackMessage: string ): Promise<T> {
  const data = await response.json().catch( () => null )
  if ( !response.ok ) {
    const message = data?.error ?? fallbackMessage
    throw new Error( message )
  }
  
  return data as T
}

export async function getFrames(): Promise<ClientFrame[]> {
  const response = await fetch( '/api/frames', { cache : 'no-store' } )
  const data = await parseJson<{ frames: ClientFrame[] }>( response, 'Failed to load frames' )
  
  return Array.isArray( data.frames ) ? data.frames : []
}

export async function deleteFrame( key: string ): Promise<void> {
  const response = await fetch( `/api/frames?key=${encodeURIComponent( key )}`, {
    method : 'DELETE',
  } )
  await parseJson( response, 'Failed to delete frame' )
}

export async function previewFrame( file: File ): Promise<{ slots: FrameSlot[]; previewUrl: string }> {
  const form = new FormData()
  form.append( 'file', file )

  const response = await fetch( '/api/frames/preview', {
    method : 'POST',
    body   : form,
  } )

  return parseJson( response, 'Failed to generate preview' )
}

export async function uploadFrame( { file, label }: { file: File; label: string } ): Promise<{ frame: ClientFrame }> {
  const form = new FormData()
  form.append( 'file', file )
  form.append( 'label', label )

  return parseJson( await fetch( '/api/frames', { method : 'POST', body : form } ), 'Upload failed' )
}

export async function getCameraStatus(): Promise<Status> {
  const response = await fetch( '/api/camera/status', { cache : 'no-store' } )
  
  return parseJson( response, 'Failed to load camera status' )
}

export async function captureShot( { sessionId, index }: { sessionId: string; index: number } ): Promise<{ file: string; url: string }> {
  const response = await fetch( '/api/camera/capture', {
    method  : 'POST',
    headers : { 'Content-Type' : 'application/json' },
    body    : JSON.stringify( { sessionId, index } ),
  } )

  return parseJson( response, 'Capture failed' )
}

export async function composeStrip( {
  sessionId,
  frame,
  files,
  adjustments,
}: {
  sessionId: string
  frame: string
  files: string[]
  adjustments: Array<{ x: number; y: number; zoom: number; filter: string }>
} ): Promise<{ url: string }> {
  const response = await fetch( '/api/camera/compose', {
    method  : 'POST',
    headers : { 'Content-Type' : 'application/json' },
    body    : JSON.stringify( { sessionId, frame, files, adjustments } ),
  } )

  return parseJson( response, 'Compose failed' )
}
