import path from "node:path";

import { getFrameFromDb } from "./frames.db";

/** Absolute directory where captures and composed strips are written. */
export const CAPTURES_DIR = path.join( process.cwd(), "captures" );

/**
 * Set PHOTOBOOTH_MOCK=1 to force the simulated camera even when a real one is
 * attached. Useful for development and demos.
 */
export const FORCE_MOCK = process.env.PHOTOBOOTH_MOCK === "1";

/** Single source photo aspect (3:2, typical of DSLR/mirrorless). */
export const PHOTO_WIDTH = 1200;
export const PHOTO_HEIGHT = 800;

/**
 * DNP RX1 printer standard: 4×6 inch paper at 300 dpi.
 * Printed strip is 2×6 (auto-cut), but the frame template must be the full 4×6.
 */
export const STRIP_WIDTH = 1200;
export const STRIP_HEIGHT = 1800;
export const STRIP_ASPECT_RATIO = 2 / 3; // width / height = 1200 / 1800

/**
 * Validate that an image matches the exact 4×6 aspect ratio (2:3).
 * Returns null if valid, or an error message string if invalid.
 */
export function validateFrameDimensions(
  width: number,
  height: number,
): string | null {
  const ratio = width / height;
  const expected = STRIP_ASPECT_RATIO;
  if ( Math.abs( ratio - expected ) > 0.001 ) {
    return `Frame must be exactly 4×6 aspect ratio (2:3, e.g. 1200×1800px). Got ${width}×${height} (ratio ${ratio.toFixed( 4 )})`;
  }

  return null;
}

export type FrameSlot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FrameDef = {
  key: string;
  label: string;
  /** Absolute path on disk to the frame image used during compose. */
  image: string;
  /** Public URL of the frame, served from /public for browser previews. */
  publicUrl: string;
  width: number;
  height: number;
  slots: FrameSlot[];
  /** True for frames bundled with the app. User uploads are false. */
  builtIn: boolean;
};

/**
 * No built-in frames — users upload their own 4×6 frames via the dashboard.
 * The old built-in frames used non-standard dimensions and have been removed.
 */
const BUILT_IN: FrameDef[] = [];

/** Keys reserved by built-in frames — user uploads must not collide with these. */
export const BUILT_IN_KEYS = new Set( BUILT_IN.map( ( f ) => f.key ) );

/** Where user-uploaded frames live (image + manifest.json). Served from /public. */
export const USER_FRAMES_DIR = path.join(
  process.cwd(),
  "public",
  "frames",
  "user",
);
export const USER_FRAMES_MANIFEST = path.join(
  USER_FRAMES_DIR,
  "manifest.json",
);

export async function getFrame( key: string ): Promise<FrameDef | null> {
  // 1. DB takes precedence — seeded built-ins + user uploads live here
  const dbFrame = await getFrameFromDb( key );
  if ( dbFrame ) {
    // If image_key is an absolute path it refers to a local file on disk;
    // otherwise it is an R2 object key and compose/preview should fetch from R2.
    const isLocalPath = dbFrame.image_key.startsWith( '/' );

    return {
      key       : dbFrame.key,
      label     : dbFrame.label,
      image     : isLocalPath ? dbFrame.image_key : '',
      publicUrl : dbFrame.image_url,
      width     : dbFrame.width,
      height    : dbFrame.height,
      slots     : dbFrame.slots as FrameSlot[],
      builtIn   : BUILT_IN_KEYS.has( dbFrame.key ),
    };
  }
  
  return null
}

export const DEFAULT_FRAME = "summer-day";

/** Upper bound on slots-per-frame; keeps file/payload validation cheap. */
export const MAX_SLOTS_PER_FRAME = 8;

/** Visual + branding tokens kept here so mock photos and styling stay in sync. */
export const FRAME = {
  accent     : "#EB4C4C",
  accentSoft : "#FFA6A6",
  textDark   : "#3a2222",
} as const;
