import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ensureCapturesDir } from "@/lib/photobooth/camera";
import { CAPTURES_DIR, PHOTO_COUNT } from "@/lib/photobooth/config";
import { composeStrip } from "@/lib/photobooth/compose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_RE = /^shot-[a-z0-9]+-\d+\.jpg$/i;
const ID_RE = /^[a-z0-9]+$/i;

export async function POST( request: Request ) {
  let files: string[] = [];
  let sessionId = "";
  try {
    const body = await request.json();
    files = Array.isArray( body.files ) ? body.files.map( String ) : [];
    sessionId = String( body.sessionId ?? "" );
  } catch {
    return Response.json( { error : "Invalid JSON body" }, { status : 400 } );
  }

  if ( !ID_RE.test( sessionId ) ) {
    return Response.json( { error : "Invalid sessionId" }, { status : 400 } );
  }
  if ( files.length === 0 || files.length > PHOTO_COUNT ) {
    return Response.json(
      { error : `Expected 1-${PHOTO_COUNT} files` },
      { status : 400 },
    );
  }
  // Reject anything that isn't a plain capture filename (no path traversal).
  if ( !files.every( ( f ) => FILE_RE.test( f ) ) ) {
    return Response.json( { error : "Invalid file name" }, { status : 400 } );
  }

  try {
    await ensureCapturesDir();
    const buffers = await Promise.all(
      files.map( ( f ) => readFile( path.join( CAPTURES_DIR, path.basename( f ) ) ) ),
    );
    const strip = await composeStrip( buffers );
    const name = `strip-${sessionId}.jpg`;
    await writeFile( path.join( CAPTURES_DIR, name ), strip );
    
    return Response.json( { file : name, url : `/api/captures/${name}` } );
  } catch ( err ) {
    return Response.json(
      { error : err instanceof Error ? err.message : "Compose failed" },
      { status : 500 },
    );
  }
}
