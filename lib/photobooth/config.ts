import path from "node:path";

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

export type FrameKey = "summer-day" | "good-vibes";

export type FrameSlot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FrameDef = {
  key: FrameKey;
  label: string;
  /** Absolute path to the frame image used during compose. */
  image: string;
  /** Public URL of the frame, served from /public for browser previews. */
  publicUrl: string;
  width: number;
  height: number;
  slots: readonly FrameSlot[];
};

/**
 * Registry of available strip templates. `slots` are pixel bounding boxes of
 * each green panel inside the frame image; the compose step replaces those
 * green pixels with the user's captured photos.
 */
export const FRAMES: Record<FrameKey, FrameDef> = {
  "summer-day" : {
    key       : "summer-day",
    label     : "Summer Day",
    image     : path.join( process.cwd(), "public", "frames", "summer-day.png" ),
    publicUrl : "/frames/summer-day.png",
    width     : 707,
    height    : 2000,
    slots     : [
      { left : 38, top : 71,   width : 631, height : 360 },
      { left : 45, top : 476,  width : 630, height : 360 },
      { left : 45, top : 881,  width : 630, height : 360 },
      { left : 32, top : 1286, width : 630, height : 360 },
    ],
  },
  "good-vibes" : {
    key       : "good-vibes",
    label     : "Good Vibes",
    image     : path.join( process.cwd(), "public", "frames", "good-vibes.jpg" ),
    publicUrl : "/frames/good-vibes.jpg",
    width     : 533,
    height    : 1600,
    slots     : [
      { left : 56, top : 47,  width : 421, height : 354 },
      { left : 56, top : 448, width : 421, height : 312 },
      { left : 60, top : 813, width : 413, height : 400 },
    ],
  },
};

export const DEFAULT_FRAME: FrameKey = "summer-day";

export const FRAME_KEYS = Object.keys( FRAMES ) as FrameKey[];

export function isFrameKey( v: unknown ): v is FrameKey {
  return typeof v === "string" && v in FRAMES;
}

export function getFrame( key: FrameKey ): FrameDef {
  return FRAMES[key];
}

/** Largest number of photos any frame currently asks for. */
export const MAX_PHOTO_COUNT = Math.max(
  ...FRAME_KEYS.map( ( k ) => FRAMES[k].slots.length ),
);

/** Visual + branding tokens kept here so mock photos and styling stay in sync. */
export const FRAME = {
  accent     : "#EB4C4C",
  accentSoft : "#FFA6A6",
  textDark   : "#3a2222",
} as const;
