import "server-only";

import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { mkdtemp, readFile, readdir, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * One long-lived `gphoto2 --shell` process owns a single libgphoto2 camera
 * session and serves BOTH live-preview frames and full still captures.
 *
 * Why a persistent shell? On the Canon EOS M6 (macOS), starting/stopping
 * `gphoto2 --capture-movie` in separate processes wedges the camera into a
 * PTP-timeout state that only a power-cycle clears. Keeping one session open
 * never tears live view down abruptly, so the camera stays healthy. The shell
 * also lets us interleave `capture-preview` and `capture-image-and-download`
 * on the same connection. See lib/photobooth/camera.ts for the mock path.
 */

// The shell prints this prompt after every command completes, e.g.
// `gphoto2: {/tmp/photobooth-x} /> ` — the {local dir} and camera path vary.
const PROMPT_RE = /gphoto2: \{[^}]*\}[^>]*>\s?$/;
const PREVIEW_FILE = "capture_preview.jpg";

/** Run a command to completion, ignoring output (used for `killall`). */
function runOnce( cmd: string, args: string[] ): Promise<void> {
  return new Promise( ( resolve, reject ) => {
    const child = spawn( cmd, args );
    child.on( "error", reject );
    child.on( "close", () => resolve() );
  } );
}

function createCameraSession() {
  let proc: ChildProcessWithoutNullStreams | null = null;
  let dir = "";
  let buf = "";
  let onPrompt: ( () => void ) | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  function handleData( chunk: string ) {
    buf += chunk;
    if ( onPrompt && PROMPT_RE.test( buf ) ) {
      const resolve = onPrompt;
      onPrompt = null;
      resolve();
    }
  }

  /** Wait for the next shell prompt; optionally write a command first. */
  function waitPrompt( command: string | null, timeoutMs: number ): Promise<string> {
    return new Promise( ( resolve, reject ) => {
      if ( command !== null && !proc?.stdin.writable ) {
        reject( new Error( "camera session is not running" ) );

        return;
      }
      buf = "";
      const timer = setTimeout( () => {
        if ( onPrompt ) {
          onPrompt = null;
          reject( new Error( `gphoto2 shell timed out: ${command ?? "startup"}` ) );
        }
      }, timeoutMs );
      onPrompt = () => {
        clearTimeout( timer );
        resolve( buf );
      };
      if ( command !== null ) proc!.stdin.write( `${command}\n` );
    } );
  }

  function kill() {
    const p = proc;
    proc = null;
    if ( !p ) return;
    try {
      p.stdin.write( "quit\n" );
    } catch {}
    setTimeout( () => {
      try {
        p.kill( "SIGKILL" );
      } catch {}
    }, 1_500 );
  }

  async function start() {
    if ( proc ) return;
    if ( process.platform === "darwin" ) {
      await runOnce( "killall", ["cameracaptured"] ).catch( () => {} );
    }
    dir = await mkdtemp( path.join( os.tmpdir(), "photobooth-" ) );
    const p = spawn( "gphoto2", ["--shell"] );
    proc = p;
    p.stdout.on( "data", ( d ) => handleData( d.toString() ) );
    p.stderr.on( "data", ( d ) => handleData( d.toString() ) );
    p.on( "close", () => {
      if ( proc === p ) proc = null;
    } );
    try {
      await waitPrompt( null, 15_000 );
      await waitPrompt( `lcd ${dir}`, 10_000 );
    } catch ( err ) {
      kill();
      throw err;
    }
  }

  /** Run `fn` exclusively against the camera (queued behind any other work). */
  function exclusive<T>( fn: () => Promise<T> ): Promise<T> {
    const result = queue.then( fn, fn );
    queue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }

  async function listLocal( predicate: ( name: string ) => boolean ) {
    const names = await readdir( dir ).catch( () => [] as string[] );

    return names.filter( predicate );
  }

  async function clearStills() {
    const stills = await listLocal( ( n ) => n !== PREVIEW_FILE );
    await Promise.all(
      stills.map( ( n ) => unlink( path.join( dir, n ) ).catch( () => {} ) ),
    );
  }

  /** Grab a single live-view preview JPEG. */
  function previewFrame(): Promise<Buffer> {
    return exclusive( async () => {
      await start();
      const file = path.join( dir, PREVIEW_FILE );
      // Delete first: a second `capture-preview` over an existing file triggers
      // an interactive "Overwrite? [y|n]" prompt that would stall the shell.
      await unlink( file ).catch( () => {} );
      await waitPrompt( "capture-preview", 15_000 );
      const data = await readFile( file );
      await unlink( file ).catch( () => {} );

      return data;
    } );
  }

  /** Capture a full-resolution still and return its bytes. */
  function captureStill(): Promise<Buffer> {
    return exclusive( async () => {
      await start();
      await clearStills();
      const out = await waitPrompt( "capture-image-and-download", 40_000 );
      const stills = ( await listLocal(
        ( n ) => n !== PREVIEW_FILE && /\.jpe?g$/i.test( n ),
      ) ).sort();
      if ( stills.length === 0 ) {
        throw new Error( `No image downloaded. ${out.trim().slice( -200 )}` );
      }
      const data = await readFile( path.join( dir, stills[stills.length - 1] ) );
      await clearStills();

      return data;
    } );
  }

  /** Gracefully close the session (e.g. on shutdown). */
  function stop() {
    kill();
  }

  return { previewFrame, captureStill, stop };
}

type CameraSession = ReturnType<typeof createCameraSession>;

// A single session per Node process, shared across Next's separate route
// bundles (module-level singletons are NOT shared between them, globalThis is).
const globalForCamera = globalThis as unknown as {
  __photoboothSession?: CameraSession;
};

export function getCameraSession(): CameraSession {
  if ( !globalForCamera.__photoboothSession ) {
    globalForCamera.__photoboothSession = createCameraSession();
  }

  return globalForCamera.__photoboothSession;
}
