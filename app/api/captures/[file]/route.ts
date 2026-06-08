import { readFile } from "node:fs/promises";
import path from "node:path";

import { CAPTURES_DIR } from "@/lib/photobooth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_RE = /^(shot|strip|raw-shot|anim|slideshow|countdown|countdown-mashup|loop)-[a-z0-9-]+\.(jpg|gif|mp4|webm)$/i;

const MIME: Record<string, string> = {
  jpg  : "image/jpeg",
  gif  : "image/gif",
  mp4  : "video/mp4",
  webm : "video/webm",
};

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/captures/[file]">,
) {
  const { file } = await ctx.params;
  const name = path.basename( file );
  if ( !FILE_RE.test( name ) ) {
    return new Response( "Not found", { status : 404 } );
  }
  try {
    const data = await readFile( path.join( CAPTURES_DIR, name ) );
    const ext = path.extname( name ).slice( 1 ).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";

    return new Response( new Uint8Array( data ), {
      headers : {
        "Content-Type"  : contentType,
        "Cache-Control" : "no-store",
      },
    } );
  } catch {
    return new Response( "Not found", { status : 404 } );
  }
}
