import { readFile } from "node:fs/promises";
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

function builtInImage( filename: string ): string {
  return path.join( process.cwd(), "public", "frames", filename );
}

/** Bundled frames shipped with the app. Slots auto-detected from #00bf63 panels. */
const BUILT_IN: FrameDef[] = [
  {
    key       : "summer-day",
    label     : "Summer Day",
    image     : builtInImage( "summer-day.png" ),
    publicUrl : "/frames/summer-day.png",
    width     : 1414,
    height    : 4000,
    builtIn   : true,
    slots     : [
      { left : 76, top : 142,  width : 1262, height : 720 },
      { left : 76, top : 952,  width : 1262, height : 721 },
      { left : 76, top : 1762, width : 1262, height : 721 },
      { left : 76, top : 2573, width : 1262, height : 720 },
    ],
  },
  {
    key       : "memory-sender",
    label     : "Memory Sender",
    image     : builtInImage( "memory-sender.png" ),
    publicUrl : "/frames/memory-sender.png",
    width     : 1414,
    height    : 4000,
    builtIn   : true,
    slots     : [
      { left : 86, top : 142,  width : 1243, height : 747 },
      { left : 86, top : 937,  width : 1243, height : 748 },
      { left : 86, top : 1732, width : 1243, height : 748 },
      { left : 86, top : 2528, width : 1243, height : 748 },
    ],
  },
  {
    key       : "multicolor-photography",
    label     : "Multicolor Photography",
    image     : builtInImage( "multicolor-photography.png" ),
    publicUrl : "/frames/multicolor-photography.png",
    width     : 1600,
    height    : 4000,
    builtIn   : true,
    slots     : [
      { left : 159, top : 392,  width : 1441, height : 716 },
      { left : 173, top : 1114, width : 1427, height : 1243 },
      { left : 188, top : 2364, width : 1412, height : 1242 },
    ],
  },
  {
    key       : "retro-portraits",
    label     : "Retro Portraits",
    image     : builtInImage( "retro-portraits.png" ),
    publicUrl : "/frames/retro-portraits.png",
    width     : 1200,
    height    : 3600,
    builtIn   : true,
    slots     : [
      { left : 359, top : 126,  width : 715, height : 1077 },
      { left : 359, top : 1260, width : 715, height : 1077 },
      { left : 359, top : 2397, width : 715, height : 1077 },
    ],
  },
  {
    key       : "family-polaroid",
    label     : "Family Polaroid",
    image     : builtInImage( "family-polaroid.png" ),
    publicUrl : "/frames/family-polaroid.png",
    width     : 1200,
    height    : 3600,
    builtIn   : true,
    slots     : [
      { left : 202, top : 206,  width : 776, height : 718 },
      { left : 210, top : 942,  width : 786, height : 769 },
      { left : 240, top : 1824, width : 707, height : 706 },
      { left : 199, top : 2615, width : 776, height : 760 },
    ],
  },
  {
    key       : "red-friendship",
    label     : "Red Friendship",
    image     : builtInImage( "red-friendship.png" ),
    publicUrl : "/frames/red-friendship.png",
    width     : 1200,
    height    : 3600,
    builtIn   : true,
    slots     : [
      { left : 126, top : 102,  width : 948, height : 803 },
      { left : 127, top : 1008, width : 946, height : 703 },
      { left : 143, top : 1826, width : 914, height : 906 },
    ],
  },
  {
    key       : "red-white-friends",
    label     : "Red & White Friends",
    image     : builtInImage( "red-white-friends.png" ),
    publicUrl : "/frames/red-white-friends.png",
    width     : 1200,
    height    : 3600,
    builtIn   : true,
    slots     : [
      { left : 125, top : 436,  width : 948, height : 948 },
      { left : 125, top : 1663, width : 948, height : 948 },
    ],
  },
  {
    key       : "white-pink",
    label     : "White & Pink",
    image     : builtInImage( "white-pink.png" ),
    publicUrl : "/frames/white-pink.png",
    width     : 1181,
    height    : 3543,
    builtIn   : true,
    slots     : [
      { left : 177, top : 192,  width : 827, height : 755 },
      { left : 177, top : 1317, width : 827, height : 754 },
      { left : 177, top : 2442, width : 827, height : 754 },
    ],
  },
];

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
  // 1. DB takes precedence — seeded built-ins + user uploads live here
  const dbFrame = await getFrameFromDb( key );
  if ( dbFrame ) {
    return {
      key       : dbFrame.key,
      label     : dbFrame.label,
      image     : "", // no local file — compose fetches from R2
      publicUrl : dbFrame.image_url,
      width     : dbFrame.width,
      height    : dbFrame.height,
      slots     : dbFrame.slots as FrameSlot[],
      builtIn   : BUILT_IN_KEYS.has( dbFrame.key ),
    };
  }

  // 2. Fall back to filesystem (built-in + legacy user-manifest frames)
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
