import {
  detectCamera,
  livePreviewFrame,
  mockPreviewFrame,
} from "@/lib/photobooth/camera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOUNDARY = "photoboothframe";
const PART_TRAILER = Buffer.from( "\r\n" );
const DETECT_INTERVAL_MS = 5_000;

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
 *
 * Camera status is re-checked every 5 s while in mock mode so the stream
 * self-heals when a camera is plugged in after the stream started. We only
 * call detectCamera() in mock mode to avoid spawning a second gphoto2 process
 * while the shell session already owns the device.
 */
export async function GET( request: Request ) {
  const initialStatus = await detectCamera();
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
  let useMock = initialStatus.mock;
  let lastDetectMs = Date.now();

  const stream = new ReadableStream( {
    async start( controller ) {
      try {
        while ( !aborted ) {
          // Re-detect only while serving mock frames — calling detectCamera()
          // while the gphoto2 shell session is active risks a device conflict.
          if ( useMock && Date.now() - lastDetectMs >= DETECT_INTERVAL_MS ) {
            try {
              const status = await detectCamera();
              useMock = status.mock;
            } catch {}
            lastDetectMs = Date.now();
          }

          const started = Date.now();
          let frame: Buffer;
          try {
            frame = useMock ? await mockPreviewFrame( tick++ ) : await livePreviewFrame();
          } catch {
            if ( aborted ) break;
            if ( !useMock ) {
              // Real camera frame failed — fall back to mock and retry detection soon
              useMock = true;
              lastDetectMs = Date.now() - ( DETECT_INTERVAL_MS - 1_000 );
            }
            await delay( 250 );
            continue;
          }
          if ( aborted ) break;
          try {
            controller.enqueue( wrap( frame ) );
          } catch {
            break; // consumer went away / controller closed
          }
          const elapsed = Date.now() - started;
          const minInterval = useMock ? 120 : 60;
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
