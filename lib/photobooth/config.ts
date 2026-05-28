import path from "node:path";

/** Number of shots that make up one photo strip. */
export const PHOTO_COUNT = 4;

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

/** Frame PNG used as the strip template (4 green slots). */
export const FRAME_IMAGE = path.join(
  process.cwd(),
  "public",
  "frames",
  "summer-day.png",
);
export const FRAME_WIDTH = 707;
export const FRAME_HEIGHT = 2000;

/**
 * Pixel bounds (in the 707x2000 frame) of each green panel that a captured
 * photo gets placed into. Detected from the source PNG; keep in sync with it.
 */
export const FRAME_SLOTS = [
  { left : 38, top : 71,   width : 631, height : 360 },
  { left : 45, top : 476,  width : 630, height : 360 },
  { left : 45, top : 881,  width : 630, height : 360 },
  { left : 32, top : 1286, width : 630, height : 360 },
] as const;

/** Visual + branding tokens kept here so mock photos and styling stay in sync. */
export const FRAME = {
  accent     : "#EB4C4C",
  accentSoft : "#FFA6A6",
  textDark   : "#3a2222",
} as const;
