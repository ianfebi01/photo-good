import { stat, open, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { CAPTURES_DIR } from "@/lib/photobooth/config";
import { getR2ObjectBuffer } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_RE = /^(shot|strip|raw-shot|anim|slideshow|countdown|countdown-mashup|loop|booth)-[a-z0-9-]+\.(jpg|gif|mp4|webm)$/i;

const MIME: Record<string, string> = {
  jpg  : "image/jpeg",
  gif  : "image/gif",
  mp4  : "video/mp4",
  webm : "video/webm",
};

/** Read a byte range [start, end] (inclusive) from a file into a Uint8Array. */
async function readRange( filePath: string, start: number, end: number ) {
  const fh = await open( filePath, "r" );
  try {
    const length = end - start + 1;
    const buf = Buffer.alloc( length );
    await fh.read( buf, 0, length, start );

    return new Uint8Array( buf );
  } finally {
    await fh.close();
  }
}

export async function GET(
  req: Request,
  ctx: RouteContext<"/api/captures/[file]">,
) {
  const { file } = await ctx.params;
  const name = path.basename( file );
  if ( !FILE_RE.test( name ) ) {
    return new Response( "Not found", { status : 404 } );
  }

  const filePath = path.join( CAPTURES_DIR, name );
  let size: number;
  let useR2Buffer: Buffer | null = null;

  try {
    const info = await stat( filePath );
    if ( !info.isFile() ) throw new Error( "Not a file" );
    size = info.size;
  } catch {
    // Fallback to Cloudflare R2
    try {
      const buffer = await getR2ObjectBuffer( `captures/${name}` );
      size = buffer.length;
      useR2Buffer = buffer;

      // Try to cache locally on disk for subsequent requests
      try {
        await mkdir( CAPTURES_DIR, { recursive : true } );
        await writeFile( filePath, buffer );
      } catch {
        // Ignore write errors (e.g. read-only filesystem)
      }
    } catch {
      return new Response( "Not found", { status : 404 } );
    }
  }

  const ext = path.extname( name ).slice( 1 ).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";

  // iOS Safari (and seeking in general) require HTTP Range support for <video>.
  // Answer Range requests with 206 Partial Content, otherwise serve the whole
  // file but always advertise Accept-Ranges so clients know ranged GETs work.
  const range = req.headers.get( "range" );
  if ( range ) {
    const match = /^bytes=(\d*)-(\d*)$/.exec( range.trim() );
    if ( match ) {
      const [, rawStart, rawEnd] = match;
      let start = rawStart === "" ? 0 : Number( rawStart );
      let end = rawEnd === "" ? size - 1 : Number( rawEnd );

      // Suffix range: "bytes=-500" → last 500 bytes
      if ( rawStart === "" && rawEnd !== "" ) {
        start = Math.max( 0, size - Number( rawEnd ) );
        end = size - 1;
      }

      if (
        Number.isNaN( start ) ||
        Number.isNaN( end ) ||
        start > end ||
        start >= size
      ) {
        return new Response( "Range Not Satisfiable", {
          status  : 416,
          headers : { "Content-Range" : `bytes */${size}` },
        } );
      }

      end = Math.min( end, size - 1 );
      
      const body = useR2Buffer 
        ? new Uint8Array( useR2Buffer.subarray( start, end + 1 ) )
        : await readRange( filePath, start, end );

      return new Response( body, {
        status  : 206,
        headers : {
          "Content-Type"   : contentType,
          "Content-Range"  : `bytes ${start}-${end}/${size}`,
          "Accept-Ranges"  : "bytes",
          "Content-Length" : String( end - start + 1 ),
          "Cache-Control"  : "no-store",
        },
      } );
    }
  }

  const body = useR2Buffer
    ? new Uint8Array( useR2Buffer )
    : await readRange( filePath, 0, size - 1 );

  return new Response( body, {
    headers : {
      "Content-Type"   : contentType,
      "Accept-Ranges"  : "bytes",
      "Content-Length" : String( size ),
      "Cache-Control"  : "no-store",
    },
  } );
}
