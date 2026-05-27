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

class CameraSession {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private dir = "";
  private buf = "";
  private onPrompt: ( () => void ) | null = null;
  // Serializes every command so preview polling and captures never overlap.
  private queue: Promise<unknown> = Promise.resolve();

  private handleData( chunk: string ) {
    this.buf += chunk;
    if ( this.onPrompt && PROMPT_RE.test( this.buf ) ) {
      const resolve = this.onPrompt;
      this.onPrompt = null;
      resolve();
    }
  }

  /** Wait for the next shell prompt; optionally write a command first. */
  private waitPrompt( command: string | null, timeoutMs: number ): Promise<string> {
    return new Promise( ( resolve, reject ) => {
      if ( command !== null && !this.proc?.stdin.writable ) {
        reject( new Error( "camera session is not running" ) );

        return;
      }
      this.buf = "";
      const timer = setTimeout( () => {
        if ( this.onPrompt ) {
          this.onPrompt = null;
          reject( new Error( `gphoto2 shell timed out: ${command ?? "startup"}` ) );
        }
      }, timeoutMs );
      this.onPrompt = () => {
        clearTimeout( timer );
        resolve( this.buf );
      };
      if ( command !== null ) this.proc!.stdin.write( `${command}\n` );
    } );
  }

  private async start() {
    if ( this.proc ) return;
    // On macOS the `cameracaptured` daemon auto-claims PTP cameras; evict it
    // so our shell can take the device.
    if ( process.platform === "darwin" ) {
      await runOnce( "killall", ["cameracaptured"] ).catch( () => {} );
    }
    this.dir = await mkdtemp( path.join( os.tmpdir(), "photobooth-" ) );
    const proc = spawn( "gphoto2", ["--shell"] );
    this.proc = proc;
    proc.stdout.on( "data", ( d ) => this.handleData( d.toString() ) );
    proc.stderr.on( "data", ( d ) => this.handleData( d.toString() ) );
    proc.on( "close", () => {
      if ( this.proc === proc ) this.proc = null;
    } );
    try {
      await this.waitPrompt( null, 15_000 ); // banner + first prompt
      await this.waitPrompt( `lcd ${this.dir}`, 10_000 );
    } catch ( err ) {
      this.kill();
      throw err;
    }
  }

  /** Run `fn` exclusively against the camera (queued behind any other work). */
  private exclusive<T>( fn: () => Promise<T> ): Promise<T> {
    const result = this.queue.then( fn, fn );
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }

  private async listLocal( predicate: ( name: string ) => boolean ) {
    const names = await readdir( this.dir ).catch( () => [] as string[] );

    return names.filter( predicate );
  }

  private async clearStills() {
    const stills = await this.listLocal( ( n ) => n !== PREVIEW_FILE );
    await Promise.all(
      stills.map( ( n ) => unlink( path.join( this.dir, n ) ).catch( () => {} ) ),
    );
  }

  /** Grab a single live-view preview JPEG. */
  previewFrame(): Promise<Buffer> {
    return this.exclusive( async () => {
      await this.start();
      const file = path.join( this.dir, PREVIEW_FILE );
      // Delete first: a second `capture-preview` over an existing file triggers
      // an interactive "Overwrite? [y|n]" prompt that would stall the shell.
      await unlink( file ).catch( () => {} );
      await this.waitPrompt( "capture-preview", 15_000 );
      const buf = await readFile( file );
      await unlink( file ).catch( () => {} );

      return buf;
    } );
  }

  /** Capture a full-resolution still and return its bytes. */
  captureStill(): Promise<Buffer> {
    return this.exclusive( async () => {
      await this.start();
      await this.clearStills();
      const out = await this.waitPrompt( "capture-image-and-download", 40_000 );
      // The EOS M6 shell capture downloads >1 JPEG per shot; keep the last.
      const stills = ( await this.listLocal(
        ( n ) => n !== PREVIEW_FILE && /\.jpe?g$/i.test( n ),
      ) ).sort();
      if ( stills.length === 0 ) {
        throw new Error( `No image downloaded. ${out.trim().slice( -200 )}` );
      }
      const buf = await readFile( path.join( this.dir, stills[stills.length - 1] ) );
      await this.clearStills();

      return buf;
    } );
  }

  private kill() {
    const proc = this.proc;
    this.proc = null;
    if ( !proc ) return;
    try {
      proc.stdin.write( "quit\n" );
    } catch {}
    setTimeout( () => {
      try {
        proc.kill( "SIGKILL" );
      } catch {}
    }, 1_500 );
  }

  /** Gracefully close the session (e.g. on shutdown). */
  stop() {
    this.kill();
  }
}

/** Run a command to completion, ignoring output (used for `killall`). */
function runOnce( cmd: string, args: string[] ): Promise<void> {
  return new Promise( ( resolve, reject ) => {
    const child = spawn( cmd, args );
    child.on( "error", reject );
    child.on( "close", () => resolve() );
  } );
}

// A single session per Node process, shared across Next's separate route
// bundles (module-level singletons are NOT shared between them, globalThis is).
const globalForCamera = globalThis as unknown as {
  __photoboothSession?: CameraSession;
};

export function getCameraSession(): CameraSession {
  if ( !globalForCamera.__photoboothSession ) {
    globalForCamera.__photoboothSession = new CameraSession();
  }

  return globalForCamera.__photoboothSession;
}
