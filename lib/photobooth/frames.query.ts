import type { ClientFrame } from './frames.client'
import type { Status } from '@/store/boothStore'

export const FRAMES_QUERY_KEY = ['frames'] as const
export const CAMERA_STATUS_QUERY_KEY = ['camera-status'] as const

export type PageArg = { page: number; limit: number }

export type FramesResponse = {
  frames: ClientFrame[]
  total: number
}

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

export async function getFrames( { page, limit }: PageArg ): Promise<FramesResponse> {
  const response = await fetch( `/api/frames?page=${page}&limit=${limit}`, { cache : 'no-store' } )
  
  return parseJson<FramesResponse>( response, 'Failed to load frames' )
}

/** Fetch all frames (unpaginated — for frame selector). */
export async function getAllFrames(): Promise<ClientFrame[]> {
  const response = await fetch( '/api/frames?page=1&limit=200', { cache : 'no-store' } )
  const data = await parseJson<FramesResponse>( response, 'Failed to load frames' )
  
  return data.frames
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

/**
 * Camera service URL resolution (runtime, no rebuild needed).
 *
 * Priority:
 *   1. `window.__CAMERA_SERVICE_URL` — set via browser console or bookmarklet
 *   2. `process.env.NEXT_PUBLIC_CAMERA_SERVICE_URL` — baked in at build time
 *   3. `null` — fall back to server API routes
 *
 * Set it from the browser console to point at your local camera service:
 *   __CAMERA_SERVICE_URL = "http://192.168.1.100:8088"
 *
 * Or bake it into the Docker build via GitHub Actions build-args.
 */
function getCameraServiceUrl(): string | null {
  // Runtime override via browser console (avoids `window` for SSR compat).
  try {
    if ( typeof __CAMERA_SERVICE_URL === "string" ) {
      return __CAMERA_SERVICE_URL as string;
    }
  } catch {
    // Not in a browser environment.
  }

  return process.env.NEXT_PUBLIC_CAMERA_SERVICE_URL ?? null;
}

/** URL for the MJPEG live preview stream (local service or server proxy). */
export function getCameraPreviewUrl( streamKey: string ): string {
  const base = getCameraServiceUrl();
  if ( base ) return `${base}/preview`;

  return `/api/camera/stream?key=${streamKey}`;
}

export async function getCameraStatus(): Promise<Status> {
  const base = getCameraServiceUrl();
  const url = base ? `${base}/status` : "/api/camera/status";
  const response = await fetch( url, { cache : "no-store" } );

  const data = await parseJson<any>( response, "Failed to load camera status" );

  // Local service returns { connected, model } — wrap into the app's Status type
  if ( base ) {
    return {
      connected : data.connected,
      mock      : !data.connected,
      model     : data.model ?? undefined,
      gphoto2   : true,
    };
  }

  return data as Status;
}

export async function captureShot( {
  sessionId,
  index,
}: {
  sessionId: string;
  index: number;
} ): Promise<{ file: string; url: string }> {
  const base = getCameraServiceUrl();

  if ( base ) {
    // Capture directly from the local camera service, then upload to server
    const captureRes = await fetch( `${base}/capture`, {
      method : "POST",
      cache  : "no-store",
    } );
    if (
      !captureRes.ok ||
      !captureRes.headers.get( "content-type" )?.startsWith( "image/" )
    ) {
      throw new Error( "Local capture failed" );
    }

    const blob = await captureRes.blob();
    const form = new FormData();
    form.append( "file", blob, `shot-${sessionId}-${index}.jpg` );
    form.append( "sessionId", sessionId );
    form.append( "index", String( index ) );

    const uploadRes = await fetch( "/api/captures/upload", {
      method : "POST",
      body   : form,
    } );

    return parseJson<{ file: string; url: string }>(
      uploadRes,
      "Capture upload failed",
    );
  }

  // Fallback: capture through the server API routes
  const response = await fetch( "/api/camera/capture", {
    method  : "POST",
    headers : { "Content-Type" : "application/json" },
    body    : JSON.stringify( { sessionId, index } ),
  } );

  return parseJson( response, "Capture failed" );
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

/* ── Frame upload helper (proxied through server) ───────────────── */

export async function uploadFrameWithSlots( {
  file,
  label,
  slots,
}: {
  file: File
  label: string
  slots: FrameSlot[]
} ): Promise<{ frame: ClientFrame }> {
  const form = new FormData()
  form.append( 'file', file )
  form.append( 'label', label )
  form.append( 'slots', JSON.stringify( slots ) )

  return parseJson( await fetch( '/api/frames/upload', { method : 'POST', body : form } ), 'Upload failed' )
}
