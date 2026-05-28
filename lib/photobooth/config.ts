import { readFile } from "node:fs/promises";
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

/** Bundled frames shipped with the app. */
const BUILT_IN: FrameDef[] = [
  {
    key       : "summer-day",
    label     : "Summer Day",
    image     : path.join( process.cwd(), "public", "frames", "summer-day.png" ),
    publicUrl : "/frames/summer-day.png",
    width     : 707,
    height    : 2000,
    builtIn   : true,
    slots     : [
      { left : 38, top : 71,   width : 631, height : 360 },
      { left : 45, top : 476,  width : 630, height : 360 },
      { left : 45, top : 881,  width : 630, height : 360 },
      { left : 32, top : 1286, width : 630, height : 360 },
    ],
  },
  {
    key       : "good-vibes",
    label     : "Good Vibes",
    image     : path.join( process.cwd(), "public", "frames", "good-vibes.jpg" ),
    publicUrl : "/frames/good-vibes.jpg",
    width     : 533,
    height    : 1600,
    builtIn   : true,
    slots     : [
      { left : 56, top : 47,  width : 421, height : 354 },
      { left : 56, top : 448, width : 421, height : 312 },
      { left : 60, top : 813, width : 413, height : 400 },
    ],
  },
];

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

type UserManifestEntry = {
  key: string;
  label: string;
  filename: string;
  width: number;
  height: number;
  slots: FrameSlot[];
};

type UserManifest = { frames: UserManifestEntry[] };

async function readUserManifest(): Promise<UserManifest> {
  try {
    const raw = await readFile( USER_FRAMES_MANIFEST, "utf8" );
    const parsed = JSON.parse( raw );
    if ( !parsed || !Array.isArray( parsed.frames ) ) return { frames : [] };

    return parsed as UserManifest;
  } catch {
    return { frames : [] };
  }
}

function userEntryToFrame( e: UserManifestEntry ): FrameDef {
  return {
    key       : e.key,
    label     : e.label,
    image     : path.join( USER_FRAMES_DIR, e.filename ),
    publicUrl : `/frames/user/${e.filename}`,
    width     : e.width,
    height    : e.height,
    slots     : e.slots,
    builtIn   : false,
  };
}

/** All frames available right now (built-in + persisted user uploads). */
export async function loadAllFrames(): Promise<FrameDef[]> {
  const manifest = await readUserManifest();
  const userFrames = manifest.frames.map( userEntryToFrame );

  return [...BUILT_IN, ...userFrames];
}

export async function getFrame( key: string ): Promise<FrameDef | null> {
  const all = await loadAllFrames();

  return all.find( ( f ) => f.key === key ) ?? null;
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
