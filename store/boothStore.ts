import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  type ClientFrame,
  DEFAULT_FRAME_KEY,
  FALLBACK_FRAMES,
} from "@/lib/photobooth/frames.client";

export type Shot = { file: string; url: string };
export type Phase =
  | "idle"
  | "running"
  | "reviewing"
  | "composing"
  | "done"
  | "error"
  | "adjusting";
export type Status = {
  connected: boolean;
  mock: boolean;
  model?: string;
  gphoto2: boolean;
};

const newId = () => Math.random().toString( 36 ).slice( 2, 10 );

// Module-level lock — avoids re-render on every capture tick
let _capturing = false;

export interface BoothState {
  // ── Persisted ──────────────────────────────────────
  started: boolean;
  frameKey: string;
  sessionId: string;
  photos: Shot[];
  strip: string | null;

  // ── Transient ──────────────────────────────────────
  phase: Phase;
  pending: Shot | null;
  flash: boolean;
  streamKey: string;
  error: string | null;
  uploadOpen: boolean;
  frames: ClientFrame[];
  status: Status | null;

  step: 0 | 1 | 2;

  // ── Actions ────────────────────────────────────────
  setStatus: ( status: Status | null ) => void;
  setFrames: ( frames: ClientFrame[] ) => void;
  selectFrame: ( key: string ) => void;
  setUploadOpen: ( open: boolean ) => void;
  restartPreview: () => void;
  start: () => void;
  reset: () => void;
  retakePending: () => void;
  addFrame: ( frame: ClientFrame ) => void;
  takeShot: ( replaceIndex?: number ) => Promise<void>;
  acceptPending: ( replaceIndex?: number ) => Promise<void>;
  composeStripWithAdjustments: ( adjustments: { x: number; y: number; zoom: number; filter: string }[] ) => Promise<void>;
}

export const useBoothStore = create<BoothState>()(
  persist(
    ( set, get ) => ( {
      // ── Initial state ──────────────────────────────
      started    : false,
      frameKey   : DEFAULT_FRAME_KEY,
      sessionId  : "",
      photos     : [],
      strip      : null,
      phase      : "idle",
      pending    : null,
      flash      : false,
      streamKey  : "live",
      error      : null,
      uploadOpen : false,
      frames     : FALLBACK_FRAMES,
      status     : null,
      step       : 0,

      // ── Setters ────────────────────────────────────
      setStatus     : ( status ) => set( { status } ),
      setFrames     : ( frames ) => set( { frames } ),
      setUploadOpen : ( uploadOpen ) => set( { uploadOpen } ),

      restartPreview : () => set( { streamKey : newId() } ),

      // ── Begin capture session ──────────────────────
      start : () => set( { started : true, step : 1 } ),

      // ── Frame selection ────────────────────────────
      selectFrame : ( key ) => {
        if ( key === get().frameKey ) return;
        _capturing = false;
        set( {
          frameKey  : key,
          started   : false,
          sessionId : "",
          phase     : "idle",
          photos    : [],
          pending   : null,
          strip     : null,
          error     : null,
          step      : 0,
        } );
        get().restartPreview();
      },

      // ── Session reset ──────────────────────────────
      reset : () => {
        _capturing = false;
        set( {
          started   : false,
          sessionId : "",
          phase     : "idle",
          photos    : [],
          pending   : null,
          strip     : null,
          error     : null,
          step      : 0,
        } );
        get().restartPreview();
      },

      // ── Retake a pending shot ──────────────────────
      retakePending : () => {
        const { phase, pending } = get();
        if ( phase !== "reviewing" || !pending ) return;
        set( { pending : null, phase : "idle" } );
        get().restartPreview();
      },

      // ── Add an uploaded frame ──────────────────────
      addFrame : ( newFrame ) => {
        const { frames } = get();
        if ( !frames.some( ( f ) => f.key === newFrame.key ) ) {
          set( { frames : [...frames, newFrame] } );
        }
        set( { uploadOpen : false } );
        get().selectFrame( newFrame.key );
      },

      // ── Capture a shot ─────────────────────────────
      takeShot : async ( replaceIndex ) => {
        const { photos, frames, frameKey } = get();
        const frame = frames.find( ( f ) => f.key === frameKey ) ?? frames[0];
        const photoCount = frame?.photoCount ?? 0;

        if ( _capturing ) return;
        if ( replaceIndex === undefined && photos.length >= photoCount ) return;
        _capturing = true;

        set( { error : null, phase : "running", flash : true } );
        try {
          const { sessionId } = get();
          const activeSession = sessionId || newId();
          if ( !sessionId ) set( { sessionId : activeSession } );
          const index = replaceIndex ?? photos.length;

          const res = await fetch( "/api/camera/capture", {
            method  : "POST",
            headers : { "Content-Type" : "application/json" },
            body    : JSON.stringify( { sessionId : activeSession, index } ),
          } );
          const data = await res.json();
          set( { flash : false } );
          if ( !res.ok ) throw new Error( data.error ?? "Capture failed" );

          set( {
            pending : { file : data.file, url : `${data.url}?v=${newId()}` },
            phase   : "reviewing",
          } );
        } catch ( err ) {
          set( {
            error : err instanceof Error ? err.message : "Something went wrong",
            phase : "error",
            flash : false,
          } );
          get().restartPreview();
        } finally {
          _capturing = false;
        }
      },

      // ── Accept pending shot ────────────────────────
      acceptPending : async ( replaceIndex ) => {
        const { pending, phase, photos, frames, frameKey } = get();
        if ( !pending || phase !== "reviewing" ) return;
        if ( _capturing ) return;
        _capturing = true;

        set( { error : null } );
        try {
          const frame = frames.find( ( f ) => f.key === frameKey ) ?? frames[0];
          const photoCount = frame?.photoCount ?? 0;
          
          const nextPhotos = [...photos];
          if ( replaceIndex !== undefined && replaceIndex < photos.length ) {
            nextPhotos[replaceIndex] = pending;
          } else {
            nextPhotos.push( pending );
          }
          set( { photos : nextPhotos, pending : null } );

          if ( nextPhotos.length >= photoCount ) {
            set( { phase : "adjusting" } );
          } else {
            set( { phase : "idle" } );
            get().restartPreview();
          }
        } catch ( err ) {
          set( {
            error : err instanceof Error ? err.message : "Accept failed",
            phase : "error",
          } );
          get().restartPreview();
        } finally {
          _capturing = false;
        }
      },

      // ── Compose strip with custom adjustments ──────
      composeStripWithAdjustments : async ( adjustments ) => {
        const { photos, frameKey, sessionId } = get();
        set( { phase : "composing", error : null } );
        try {
          const activeSession = sessionId || newId();
          const res = await fetch( "/api/camera/compose", {
            method  : "POST",
            headers : { "Content-Type" : "application/json" },
            body    : JSON.stringify( {
              sessionId : activeSession,
              frame     : frameKey,
              files     : photos.map( ( s ) => s.file ),
              adjustments,
            } ),
          } );
          const composed = await res.json();
          if ( !res.ok ) throw new Error( composed.error ?? "Compose failed" );
          set( { strip : composed.url, phase : "done", step : 2 } );
        } catch ( err ) {
          set( {
            error : err instanceof Error ? err.message : "Compose failed",
            phase : "error",
          } );
        }
      },
    } ),
    {
      name       : "booth-store",
      storage    : createJSONStorage( () => localStorage ),
      partialize : ( state ) => ( {
        started   : state.started,
        frameKey  : state.frameKey,
        sessionId : state.sessionId,
        photos    : state.photos,
        strip     : state.strip,
      } ),
    },
  ),
);
