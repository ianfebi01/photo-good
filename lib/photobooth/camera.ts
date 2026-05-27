import "server-only";

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

import {
  CAPTURES_DIR,
  FORCE_MOCK,
  FRAME,
  PHOTO_HEIGHT,
  PHOTO_WIDTH,
} from "./config";
import { getCameraSession } from "./session";

export type CameraStatus = {
  /** A real camera is reachable and will be used. */
  connected: boolean;
  /** True when frames/captures are simulated (no camera, or PHOTOBOOTH_MOCK=1). */
  mock: boolean;
  /** Detected camera model, when available. */
  model?: string;
  /** True when the gphoto2 binary is installed. */
  gphoto2: boolean;
};

export async function ensureCapturesDir() {
  await mkdir( CAPTURES_DIR, { recursive : true } );
}

/** Run a command and resolve with its stdout buffer (rejects on non-zero exit). */
function run(
  cmd: string,
  args: string[],
  timeoutMs = 20_000,
): Promise<Buffer> {
  return new Promise( ( resolve, reject ) => {
    const child = spawn( cmd, args );
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout( () => {
      child.kill( "SIGKILL" );
      reject( new Error( `${cmd} timed out` ) );
    }, timeoutMs );

    child.stdout.on( "data", ( d ) => out.push( d ) );
    child.stderr.on( "data", ( d ) => err.push( d ) );
    child.on( "error", ( e ) => {
      clearTimeout( timer );
      reject( e );
    } );
    child.on( "close", ( code ) => {
      clearTimeout( timer );
      if ( code === 0 ) resolve( Buffer.concat( out ) );
      else
        reject(
          new Error(
            `${cmd} exited ${code}: ${Buffer.concat( err ).toString().trim()}`,
          ),
        );
    } );
  } );
}

let gphoto2Available: boolean | null = null;

async function hasGphoto2() {
  if ( gphoto2Available !== null ) return gphoto2Available;
  try {
    await run( "gphoto2", ["--version"], 5_000 );
    gphoto2Available = true;
  } catch {
    gphoto2Available = false;
  }
  
  return gphoto2Available;
}

export async function detectCamera(): Promise<CameraStatus> {
  const gphoto2 = await hasGphoto2();
  if ( !gphoto2 ) return { connected : false, mock : true, gphoto2 : false };

  let model: string | undefined;
  let connected = false;
  try {
    const out = ( await run( "gphoto2", ["--auto-detect"], 8_000 ) ).toString();
    // First two lines are a header + separator; any further row is a camera.
    const rows = out
      .split( "\n" )
      .slice( 2 )
      .map( ( l ) => l.trim() )
      .filter( Boolean );
    if ( rows.length > 0 ) {
      connected = true;
      model = rows[0].replace( /\s{2,}.*$/, "" ).trim();
    }
  } catch {
    connected = false;
  }

  const mock = FORCE_MOCK || !connected;
  
  return { connected : connected && !FORCE_MOCK, mock, model, gphoto2 };
}

/**
 * Capture one full-resolution still as a JPEG buffer. Real captures go through
 * the persistent gphoto2 shell session (see ./session) so live view and stills
 * share one camera connection and never wedge the device.
 */
export async function captureStill( seq = 0 ): Promise<Buffer> {
  const status = await detectCamera();
  if ( status.mock ) return mockPhoto( seq );

  return getCameraSession().captureStill();
}

/** Grab one live-view preview frame from the persistent camera session. */
export function livePreviewFrame(): Promise<Buffer> {
  return getCameraSession().previewFrame();
}

// ---------------------------------------------------------------------------
// Mock camera (sharp-generated frames) — used when no camera is attached.
// ---------------------------------------------------------------------------

const MOCK_TINTS = [
  FRAME.accent,
  "#FF7070",
  FRAME.accentSoft,
  "#FFD27A",
  "#7AC7FF",
  "#9DE39D",
];

function escapeXml( s: string ) {
  return s.replace( /[<>&'"]/g, ( c ) =>
    ( { "<" : "&lt;", ">" : "&gt;", "&" : "&amp;", "'" : "&apos;", '"' : "&quot;" } )[
      c
    ] as string,
  );
}

/** A single simulated still — distinct per `seq` so a strip shows variety. */
export async function mockPhoto( seq = 0 ): Promise<Buffer> {
  const tint = MOCK_TINTS[seq % MOCK_TINTS.length];
  const stamp = new Date().toLocaleString();
  const svg = `
<svg width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${tint}"/>
      <stop offset="100%" stop-color="${FRAME.textDark}"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="44%" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="120" font-weight="800" fill="#ffffff" opacity="0.92">MOCK</text>
  <text x="50%" y="56%" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="56" font-weight="700" fill="#ffffff" opacity="0.9">Pose #${seq + 1}</text>
  <text x="50%" y="92%" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="30" fill="#ffffff" opacity="0.85">${escapeXml( stamp )}</text>
</svg>`;
  
  return sharp( Buffer.from( svg ) ).jpeg( { quality : 88 } ).toBuffer();
}

/** A single simulated live-preview frame (animated by `tick`). */
export async function mockPreviewFrame( tick: number ): Promise<Buffer> {
  const w = 800;
  const h = 533;
  const x = 50 + Math.round( 40 * Math.sin( tick / 6 ) );
  const y = 50 + Math.round( 18 * Math.cos( tick / 5 ) );
  const svg = `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${FRAME.textDark}"/>
  <circle cx="${x}%" cy="${y}%" r="120" fill="${FRAME.accent}" opacity="0.55"/>
  <circle cx="${100 - x}%" cy="${100 - y}%" r="90" fill="${FRAME.accentSoft}" opacity="0.5"/>
  <text x="50%" y="50%" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="40" font-weight="700" fill="#ffffff" opacity="0.9">LIVE • mock camera</text>
</svg>`;
  
  return sharp( Buffer.from( svg ) ).jpeg( { quality : 70 } ).toBuffer();
}
