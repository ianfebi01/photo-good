import "server-only";

import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { mkdtemp, readFile, readdir, rm, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * A long-lived `gphoto2 --shell` process serves live-preview frames, while
 * full still captures run as fresh one-shot `gphoto2 --capture-image-and-download`
 * processes.
 *
 * Why one-shot captures? The persistent shell binds to one libgphoto2 device
 * handle; a USB reconnect kills that handle ("PTP No Device") and the shell
 * never recovers. A fresh capture process re-enumerates the camera every time,
 * so it works reliably even after the camera is unplugged and plugged back in.
 * Before capturing we kill the preview shell to free the device, then let the
 * preview loop re-spawn it afterward. See lib/photobooth/camera.ts for the mock
 * path.
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

/**
 * Run a fresh one-shot capture into `dir`, rejecting on non-zero exit. Files
 * are named `cap-N.ext`; the EOS M6 downloads >1 JPEG per shot, so callers pick
 * the last one.
 */
function captureToDir( dir: string, timeoutMs = 40_000 ): Promise<void> {
  return new Promise( ( resolve, reject ) => {
    const child = spawn(
      "gphoto2",
      [
        "--capture-image-and-download",
        "--filename",
        "cap-%n.%C",
        "--force-overwrite",
      ],
      { cwd : dir },
    );
    const err: Buffer[] = [];
    const timer = setTimeout( () => {
      child.kill( "SIGKILL" );
      reject( new Error( "gphoto2 capture timed out" ) );
    }, timeoutMs );
    child.stderr.on( "data", ( d ) => err.push( d ) );
    child.on( "error", ( e ) => {
      clearTimeout( timer );
      reject( e );
    } );
    child.on( "close", ( code ) => {
      clearTimeout( timer );
      if ( code === 0 ) resolve();
      else
        reject(
          new Error(
            `gphoto2 capture exited ${code}: ${Buffer.concat( err ).toString().trim().slice( -200 )}`,
          ),
        );
    } );
  } );
}

function createCameraSession() {
  let proc: ChildProcessWithoutNullStreams | null = null;
  let dir = "";
  let buf = "";
  let onPrompt: ( () => void ) | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  // Resolves once a killed shell has fully exited and released the USB device.
  // start() awaits this so a fresh shell never races a dying one for the camera.
  let closing: Promise<void> | null = null;

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
          kill(); // reset broken session so next start() spawns a fresh shell
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
    // Track full exit so the next start() can wait for the USB device to free.
    closing = new Promise<void>( ( resolve ) => {
      p.once( "close", () => resolve() );
    } );
    try {
      p.stdin.write( "quit\n" );
    } catch {}
    // A dead PTP device won't answer `quit`; force the process down quickly so
    // a fresh shell can re-bind to the reconnected camera without contention.
    const forceKill = setTimeout( () => {
      try {
        p.kill( "SIGKILL" );
      } catch {}
    }, 500 );
    p.once( "close", () => clearTimeout( forceKill ) );
  }

  async function start() {
    if ( proc ) return;
    // Wait for any prior shell to fully release the camera before spawning.
    if ( closing ) {
      await closing;
      closing = null;
    }
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

  /** Grab a single live-view preview JPEG. */
  function previewFrame(): Promise<Buffer> {
    return exclusive( async () => {
      await start();
      try {
        const file = path.join( dir, PREVIEW_FILE );
        // Delete first: a second `capture-preview` over an existing file
        // triggers an interactive "Overwrite? [y|n]" prompt that stalls the shell.
        await unlink( file ).catch( () => {} );
        await waitPrompt( "capture-preview", 15_000 );
        const data = await readFile( file );
        await unlink( file ).catch( () => {} );

        return data;
      } catch ( err ) {
        // The shell survives a camera unplug but its libgphoto2 session is now
        // bound to a dead USB device. Tear it down so the next call spawns a
        // fresh shell that re-binds to the reconnected camera.
        kill();
        throw err;
      }
    } );
  }

  /**
   * Capture a full-resolution still via a fresh one-shot gphoto2 process.
   *
   * We first tear down the persistent preview shell to release the camera, then
   * spawn `gphoto2 --capture-image-and-download`. Running queued behind any
   * in-flight preview frame (via exclusive) guarantees only one process touches
   * the device at a time. The preview loop re-spawns the shell on its next
   * frame, so live view resumes automatically after the shot.
   */
  function captureStill(): Promise<Buffer> {
    return exclusive( async () => {
      // Free the device from the preview shell and wait for it to fully exit.
      kill();
      if ( closing ) {
        await closing;
        closing = null;
      }
      // macOS auto-claims PTP cameras with this daemon; evict it first.
      if ( process.platform === "darwin" ) {
        await runOnce( "killall", ["cameracaptured"] ).catch( () => {} );
      }

      const shotDir = await mkdtemp( path.join( os.tmpdir(), "photobooth-shot-" ) );
      try {
        await captureToDir( shotDir );
        const stills = ( await readdir( shotDir ) )
          .filter( ( n ) => /\.jpe?g$/i.test( n ) )
          .sort();
        if ( stills.length === 0 ) {
          throw new Error( "No image downloaded from camera" );
        }
        // The EOS M6 downloads >1 JPEG per shot; keep the last (full-res) one.
        const data = await readFile( path.join( shotDir, stills[stills.length - 1] ) );

        return data;
      } finally {
        await rm( shotDir, { recursive : true, force : true } ).catch( () => {} );
      }
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
