import {
  detectCamera,
  livePreviewFrame,
  mockPreviewFrame,
} from "@/lib/photobooth/camera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOUNDARY = "photoboothframe";
const PART_TRAILER = Buffer.from( "\r\n" );

const delay = ( ms: number ) => new Promise( ( r ) => setTimeout( r, ms ) );

function wrap( jpeg: Buffer ) {
  const header = Buffer.from(
    `--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`,
  );

  return Buffer.concat( [header, jpeg, PART_TRAILER] );
}

/**
 * Live preview as multipart/x-mixed-replace MJPEG, consumable directly by an
 * <img> tag. Frames are pulled one at a time: real frames come from the
 * persistent gphoto2 shell session (capture-preview), mock frames are
 * synthesized. The loop stops on abort so the camera is freed for a capture.
 */
export async function GET( request: Request ) {
  const status = await detectCamera();
  const headers = {
    "Content-Type"  : `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
    "Cache-Control" : "no-store, no-cache, must-revalidate",
    "Pragma"        : "no-cache",
    "Connection"    : "close",
  };

  let aborted = false;
  const stop = () => {
    aborted = true;
  };
  request.signal.addEventListener( "abort", stop );

  let tick = 0;
  const nextFrame = status.mock
    ? () => mockPreviewFrame( tick++ )
    : () => livePreviewFrame();
  const minInterval = status.mock ? 120 : 60;

  const stream = new ReadableStream( {
    async start( controller ) {
      try {
        while ( !aborted ) {
          const started = Date.now();
          let frame: Buffer;
          try {
            frame = await nextFrame();
          } catch {
            if ( aborted ) break;
            await delay( 250 ); // transient hiccup — pause, then retry
            continue;
          }
          if ( aborted ) break;
          try {
            controller.enqueue( wrap( frame ) );
          } catch {
            break; // consumer went away / controller closed
          }
          const elapsed = Date.now() - started;
          if ( elapsed < minInterval ) await delay( minInterval - elapsed );
        }
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      stop();
    },
  } );

  return new Response( stream, { headers } );
}
