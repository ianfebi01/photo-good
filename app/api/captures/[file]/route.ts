import { readFile } from "node:fs/promises";
import path from "node:path";

import { CAPTURES_DIR } from "@/lib/photobooth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_RE = /^(shot|strip)-[a-z0-9-]+\.jpg$/i;

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
    
    return new Response( new Uint8Array( data ), {
      headers : {
        "Content-Type"  : "image/jpeg",
        "Cache-Control" : "no-store",
      },
    } );
  } catch {
    return new Response( "Not found", { status : 404 } );
  }
}
