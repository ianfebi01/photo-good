"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const PHOTO_COUNT = 4;

type Shot = { file: string; url: string };
type Phase = "idle" | "running" | "composing" | "done" | "error";
type Status = {
  connected: boolean;
  mock: boolean;
  model?: string;
  gphoto2: boolean;
};

const newId = () => Math.random().toString( 36 ).slice( 2, 10 );

export default function BoothPage() {
  const [status, setStatus] = useState<Status | null>( null );
  const [phase, setPhase] = useState<Phase>( "idle" );
  const [photos, setPhotos] = useState<Shot[]>( [] );
  const [strip, setStrip] = useState<string | null>( null );
  const [flash, setFlash] = useState( false );
  const [previewOn, setPreviewOn] = useState( true );
  const [streamKey, setStreamKey] = useState( "live" );
  const [error, setError] = useState<string | null>( null );
  const [sessionId, setSessionId] = useState<string>( "" );

  const runningRef = useRef( false );

  const restartPreview = useCallback( () => {
    setStreamKey( newId() );
    setPreviewOn( true );
  }, [] );

  useEffect( () => {
    fetch( "/api/camera/status" )
      .then( ( r ) => r.json() )
      .then( setStatus )
      .catch( () => setStatus( { connected : false, mock : true, gphoto2 : false } ) );
  }, [] );

  const reset = useCallback( () => {
    runningRef.current = false;
    setSessionId( "" );
    setPhase( "idle" );
    setPhotos( [] );
    setStrip( null );
    setError( null );
    restartPreview();
  }, [restartPreview] );

  const capturePhoto = useCallback( async () => {
    if ( runningRef.current ) return;
    if ( photos.length >= PHOTO_COUNT ) return;
    runningRef.current = true;
    setError( null );
    try {
      const activeSession = sessionId || newId();
      if ( !sessionId ) setSessionId( activeSession );
      const index = photos.length;

      setPreviewOn( false );
      setPhase( "running" );
      setFlash( true );

      const res = await fetch( "/api/camera/capture", {
        method  : "POST",
        headers : { "Content-Type" : "application/json" },
        body    : JSON.stringify( { sessionId : activeSession, index } ),
      } );
      const data = await res.json();
      setFlash( false );
      if ( !res.ok ) throw new Error( data.error ?? "Capture failed" );

      const nextPhotos = [...photos, data];
      setPhotos( nextPhotos );

      if ( nextPhotos.length >= PHOTO_COUNT ) {
        setPhase( "composing" );
        const compose = await fetch( "/api/camera/compose", {
          method  : "POST",
          headers : { "Content-Type" : "application/json" },
          body    : JSON.stringify( {
            sessionId : activeSession,
            files     : nextPhotos.map( ( s ) => s.file ),
          } ),
        } );
        const composed = await compose.json();
        if ( !compose.ok ) throw new Error( composed.error ?? "Compose failed" );
        setStrip( composed.url );
        setPhase( "done" );
      } else {
        setPhase( "idle" );
        restartPreview();
      }
    } catch ( err ) {
      setError( err instanceof Error ? err.message : "Something went wrong" );
      setPhase( "error" );
      setFlash( false );
      restartPreview();
    } finally {
      runningRef.current = false;
    }
  }, [photos, restartPreview, sessionId] );

  const liveSrc = useMemo( () => `/api/camera/stream?key=${streamKey}`, [streamKey] );
  const running = useMemo( () => phase === "running", [phase] );
  const composing = useMemo( () => phase === "composing", [phase] );
  const done = useMemo( () => phase === "done", [phase] );
  const busy = running || composing;
  const remaining = PHOTO_COUNT - photos.length;
  const canCapture = !busy && remaining > 0;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Photobooth
          </h1>
          <p className="text-sm text-muted-foreground">
            {PHOTO_COUNT} shots · summer-day frame
          </p>
        </div>
        <CameraBadge status={status} />
      </header>

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden p-0">
          <CardContent className="relative aspect-[3/2] bg-foreground p-0">
            <img
              key={streamKey}
              src={liveSrc}
              alt="Live camera preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {previewOn === false && (
              <div className="absolute inset-0 grid place-items-center text-xl text-white bg-white/30">
                {running ? "Capturing…" : composing ? "Composing…" : "Starting camera…"}
              </div>
            )}

            {flash && <div className="absolute inset-0 animate-pulse bg-white" />}

            {photos.length > 0 && !done && (
              <div className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                {photos.length} / {PHOTO_COUNT}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <Progress value={( photos.length / PHOTO_COUNT ) * 100} />

              <div className="flex gap-2">
                <Button className="flex-1"
                  onClick={capturePhoto}
                  disabled={!canCapture}
                >
                  {composing
                    ? "Composing…"
                    : running
                      ? "Capturing…"
                      : remaining === 0
                        ? "All shots taken"
                        : `Capture photo (${remaining} left)`}
                </Button>
                <Button variant="outline"
                  onClick={reset}
                  disabled={busy || ( photos.length === 0 && !strip )}
                >
                  Reset
                </Button>
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            {Array.from( { length : PHOTO_COUNT } ).map( ( _, i ) => {
              const shot = photos[i];

              return (
                <div
                  key={i}
                  className="relative aspect-[3/2] overflow-hidden rounded-md border bg-muted"
                >
                  {shot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shot.url}
                      alt={`Shot ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                  )}
                </div>
              );
            } )}
          </div>
        </div>
      </div>

      {strip && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Your strip is ready
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={strip}
              alt="Composed photo strip"
              className="max-h-[70vh] w-auto rounded-lg border shadow-sm"
            />
            <div className="flex gap-2">
              <a href={strip}
                download="photobooth-strip.jpg"
              >
                <Button>Download strip</Button>
              </a>
              <Button variant="outline"
                onClick={reset}
              >
                New session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function CameraBadge( { status }: { status: Status | null } ) {
  if ( !status ) {
    return (
      <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        Detecting camera…
      </span>
    );
  }
  if ( status.connected ) {
    return (
      <span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
        <span className="size-2 rounded-full bg-emerald-500" />
        {status.model ?? "Camera ready"}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
      <span className="size-2 rounded-full bg-amber-500" />
      {status.gphoto2 ? "No camera — mock mode" : "gphoto2 missing — mock mode"}
    </span>
  );
}
