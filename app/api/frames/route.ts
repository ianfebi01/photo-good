import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  BUILT_IN_KEYS,
  MAX_SLOTS_PER_FRAME,
  USER_FRAMES_DIR,
  USER_FRAMES_MANIFEST,
  loadAllFrames,
} from "@/lib/photobooth/config";
import { detectGreenSlots } from "@/lib/photobooth/slots";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB upload cap
const ALLOWED_TYPES = new Set( ["image/png"] );

function slugify( raw: string ): string {
  return raw
    .toLowerCase()
    .trim()
    .replace( /[^a-z0-9]+/g, "-" )
    .replace( /^-+|-+$/g, "" )
    .slice( 0, 32 );
}

function extFromType( type: string ): string {
  if ( type === "image/png" ) return "png";
  if ( type === "image/webp" ) return "webp";

  return "jpg";
}

async function ensureUserDir() {
  await mkdir( USER_FRAMES_DIR, { recursive : true } );
}

async function readManifest(): Promise<{ frames: ManifestEntry[] }> {
  try {
    const raw = await readFile( USER_FRAMES_MANIFEST, "utf8" );
    const parsed = JSON.parse( raw );
    if ( !parsed || !Array.isArray( parsed.frames ) ) return { frames : [] };

    return parsed;
  } catch {
    return { frames : [] };
  }
}

type ManifestEntry = {
  key: string;
  label: string;
  filename: string;
  width: number;
  height: number;
  slots: Array<{ left: number; top: number; width: number; height: number }>;
};

async function writeManifest( manifest: { frames: ManifestEntry[] } ) {
  await writeFile(
    USER_FRAMES_MANIFEST,
    JSON.stringify( manifest, null, 2 ) + "\n",
    "utf8",
  );
}

async function requireFrameAdmin() {
  const user = await getCurrentUser();
  if ( !user || !hasRole( user.role, "admin" ) ) {
    return Response.json( { error : "Forbidden" }, { status : 403 } );
  }

  return null;
}

/** Return a paginated frame catalog (built-in + user-uploaded) for the client. */
export async function GET( request: Request ) {
  const { searchParams } = new URL( request.url );
  const page = Math.max( 1, Number( searchParams.get( "page" ) ) || 1 );
  const limit = Math.min( 50, Math.max( 1, Number( searchParams.get( "limit" ) ) || 8 ) );

  const all = await loadAllFrames();
  const total = all.length;
  const start = ( page - 1 ) * limit;
  const pageFrames = all.slice( start, start + limit );

  const payload = pageFrames.map( ( f ) => ( {
    key        : f.key,
    label      : f.label,
    publicUrl  : f.publicUrl,
    width      : f.width,
    height     : f.height,
    photoCount : f.slots.length,
    slots      : f.slots,
    builtIn    : f.builtIn,
  } ) );

  return Response.json( { frames : payload, total } );
}

/**
 * Accept a user-uploaded frame image. Multipart form fields:
 *   - file: PNG/JPEG/WEBP, ≤ 8 MB, with solid-green panels marking each slot
 *   - label: human-readable name
 */
export async function POST( request: Request ) {
  const forbidden = await requireFrameAdmin();
  if ( forbidden ) return forbidden;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json( { error : "Expected multipart/form-data" }, { status : 400 } );
  }

  const file = form.get( "file" );
  const labelRaw = String( form.get( "label" ) ?? "" ).trim();

  if ( !( file instanceof File ) ) {
    return Response.json( { error : "Missing file" }, { status : 400 } );
  }
  if ( !labelRaw ) {
    return Response.json( { error : "Missing label" }, { status : 400 } );
  }
  if ( labelRaw.length > 60 ) {
    return Response.json( { error : "Label too long (max 60 chars)" }, { status : 400 } );
  }
  if ( !ALLOWED_TYPES.has( file.type ) ) {
    return Response.json(
      { error : "Unsupported image type (use PNG)" },
      { status : 400 },
    );
  }
  if ( file.size > MAX_BYTES ) {
    return Response.json( { error : "File too large (max 8 MB)" }, { status : 400 } );
  }

  const buffer = Buffer.from( await file.arrayBuffer() );

  // Confirm the bytes really are an image sharp can decode.
  let meta: sharp.Metadata;
  try {
    meta = await sharp( buffer ).metadata();
  } catch {
    return Response.json( { error : "Could not decode image" }, { status : 400 } );
  }
  if ( !meta.width || !meta.height ) {
    return Response.json( { error : "Image has no dimensions" }, { status : 400 } );
  }

  const detected = await detectGreenSlots( buffer );
  if ( detected.slots.length === 0 ) {
    return Response.json(
      { error : "No green slots detected — paint each photo area solid green" },
      { status : 400 },
    );
  }
  if ( detected.slots.length > MAX_SLOTS_PER_FRAME ) {
    return Response.json(
      { error : `Too many slots detected (${detected.slots.length}); max ${MAX_SLOTS_PER_FRAME}` },
      { status : 400 },
    );
  }

  await ensureUserDir();
  const manifest = await readManifest();

  const baseSlug = slugify( labelRaw ) || "frame";
  const existing = new Set( manifest.frames.map( ( f ) => f.key ) );
  let key = `user-${baseSlug}`;
  let suffix = 2;
  while ( existing.has( key ) || BUILT_IN_KEYS.has( key ) ) {
    key = `user-${baseSlug}-${suffix++}`;
  }

  const ext = extFromType( file.type );
  const filename = `${key}.${ext}`;
  await writeFile( path.join( USER_FRAMES_DIR, filename ), buffer );

  const entry: ManifestEntry = {
    key,
    label  : labelRaw,
    filename,
    width  : detected.width,
    height : detected.height,
    slots  : detected.slots,
  };
  manifest.frames.push( entry );
  await writeManifest( manifest );

  return Response.json( {
    frame : {
      key,
      label      : entry.label,
      publicUrl  : `/frames/user/${filename}`,
      width      : entry.width,
      height     : entry.height,
      photoCount : entry.slots.length,
      builtIn    : false,
    },
  } );
}

/**
 * Delete a user-uploaded frame. Query parameters:
 *   - key: the frame key (must start with "user-")
 */
export async function DELETE( request: Request ) {
  const forbidden = await requireFrameAdmin();
  if ( forbidden ) return forbidden;

  const { searchParams } = new URL( request.url );
  const key = searchParams.get( "key" );

  if ( !key ) {
    return Response.json( { error : "Missing key parameter" }, { status : 400 } );
  }

  if ( !key.startsWith( "user-" ) ) {
    return Response.json( { error : "Cannot delete built-in frames" }, { status : 400 } );
  }

  const manifest = await readManifest();
  const entryIndex = manifest.frames.findIndex( ( f ) => f.key === key );

  if ( entryIndex === -1 ) {
    return Response.json( { error : "Frame not found" }, { status : 404 } );
  }

  const entry = manifest.frames[entryIndex];
  const filePath = path.join( USER_FRAMES_DIR, entry.filename );

  try {
    await unlink( filePath );
  } catch {
    // If the file is already gone, proceed to clean up manifest
  }

  manifest.frames.splice( entryIndex, 1 );
  await writeManifest( manifest );

  return Response.json( { success : true } );
}
