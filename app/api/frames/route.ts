import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

import {
  BUILT_IN_KEYS,
  USER_FRAMES_DIR,
  USER_FRAMES_MANIFEST,
} from "@/lib/photobooth/config";
import { getAllFramesFromDb, deleteFrameFromDb } from "@/lib/photobooth/frames.db";
import { deleteR2Object } from "@/lib/r2";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/types";
import { ensureAuthSchema } from "@/lib/auth/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  await ensureAuthSchema();
  const dbFrames = await getAllFramesFromDb();

  const all = [
    ...dbFrames.map( ( f ) => ( {
      key       : f.key,
      label     : f.label,
      image     : "",
      publicUrl : f.image_url,
      width     : f.width,
      height    : f.height,
      slots     : f.slots,
      builtIn   : BUILT_IN_KEYS.has( f.key ),
    } ) ),
  ];

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

  // Try DB first (R2-backed frames)
  const deletedDb = await deleteFrameFromDb( key );

  if ( deletedDb ) {
    // Clean up R2
    await deleteR2Object( deletedDb.image_key ).catch( () => {
      // Ignore R2 errors — the object may already be gone
    } );

    return Response.json( { success : true } );
  }

  // Fall back to filesystem manifest
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
