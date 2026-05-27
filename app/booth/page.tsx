"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const PHOTO_COUNT = 6;
const TIMER_OPTIONS = [3, 5, 10] as const;

type Shot = { file: string; url: string };
type Phase = "idle" | "running" | "composing" | "done" | "error";
type Status = {
  connected: boolean;
  mock: boolean;
  model?: string;
  gphoto2: boolean;
};

const wait = ( ms: number ) => new Promise( ( r ) => setTimeout( r, ms ) );
const newId = () => Math.random().toString( 36 ).slice( 2, 10 );

export default function BoothPage() {
  const [status, setStatus] = useState<Status | null>( null );
  const [timer, setTimer] = useState<number>( 3 );
  const [phase, setPhase] = useState<Phase>( "idle" );
  const [count, setCount] = useState( 0 );
  const [current, setCurrent] = useState( 0 );
  const [photos, setPhotos] = useState<Shot[]>( [] );
  const [strip, setStrip] = useState<string | null>( null );
  const [flash, setFlash] = useState( false );
  // A stable initial key keeps SSR and the first client render identical (no
  // hydration mismatch); newId() is only used later, from user-driven actions.
  const [previewOn, setPreviewOn] = useState( true );
  const [streamKey, setStreamKey] = useState( "live" );
  const [error, setError] = useState<string | null>( null );

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
    setPhase( "idle" );
    setPhotos( [] );
    setStrip( null );
    setCurrent( 0 );
    setCount( 0 );
    setError( null );
    restartPreview();
  }, [restartPreview] );

  // const run = useCallback( async () => {
  //   if ( runningRef.current ) return;
  //   runningRef.current = true;
  //   setError( null );
  //   setStrip( null );
  //   setPhotos( [] );
  //   setPhase( "running" );
  //   const sessionId = newId();
  //   const shots: Shot[] = [];

  //   try {
  //     for ( let i = 0; i < PHOTO_COUNT; i++ ) {
  //       if ( !runningRef.current ) return;
  //       setCurrent( i );
  //       restartPreview();

  //       for ( let n = timer; n > 0; n-- ) {
  //         if ( !runningRef.current ) return;
  //         setCount( n );
  //         await wait( 1000 );
  //       }
  //       setCount( 0 );
  //       if ( !runningRef.current ) return;

  //       // Release the camera from live view, then take the still.
  //       setPreviewOn( false );
  //       setFlash( true );
  //       await wait( 120 );

  //       const res = await fetch( "/api/camera/capture", {
  //         method  : "POST",
  //         headers : { "Content-Type" : "application/json" },
  //         body    : JSON.stringify( { sessionId, index : i } ),
  //       } );
  //       const data = await res.json();
  //       setFlash( false );
  //       if ( !res.ok ) throw new Error( data.error ?? "Capture failed" );

  //       shots.push( data );
  //       setPhotos( [...shots] );
  //       if ( i < PHOTO_COUNT - 1 ) await wait( 900 );
  //     }

  //     if ( !runningRef.current ) return;
  //     setPhase( "composing" );
  //     const res = await fetch( "/api/camera/compose", {
  //       method  : "POST",
  //       headers : { "Content-Type" : "application/json" },
  //       body    : JSON.stringify( { sessionId, files : shots.map( ( s ) => s.file ) } ),
  //     } );
  //     const data = await res.json();
  //     if ( !res.ok ) throw new Error( data.error ?? "Compose failed" );
  //     setStrip( data.url );
  //     setPhase( "done" );
  //   } catch ( err ) {
  //     setError( err instanceof Error ? err.message : "Something went wrong" );
  //     setPhase( "error" );
  //   } finally {
  //     runningRef.current = false;
  //   }
  // }, [timer, restartPreview] );

  const capturePhoto = useCallback( async ( ) => {
    const sessionId = newId();
    setPreviewOn( false );
    setPhase( "running" );
    const res = await fetch( "/api/camera/capture", {
      method  : "POST",
      headers : { "Content-Type" : "application/json" },
      body    : JSON.stringify( { sessionId, index : 1 } ),
    } );
    const data = await res.json();
    setFlash( false );
    if ( !res.ok ) throw new Error( data.error ?? "Capture failed" );
    setPhotos( ( prev )=>  [...prev, data] );
    setPreviewOn( true );
  }, [] );

  const liveSrc = useMemo( () => `/api/camera/stream?key=${streamKey}`, [streamKey] );
  const idle = useMemo( () => phase === "idle", [phase] );
  const running = useMemo( () => phase === "running", [phase] );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Photobooth
          </h1>
          <p className="text-sm text-muted-foreground">
            6 shots · {timer}s timer · vertical strip
          </p>
        </div>
        <CameraBadge status={status} />
      </header>

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        {/* Live preview / countdown stage */}
        <Card className="overflow-hidden p-0">
          <CardContent className="relative aspect-[3/2] bg-foreground p-0">
            <img
              key={streamKey}
              src={liveSrc}
              alt="Live camera preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Overlays */}
            {previewOn === false && (
              <div className="absolute inset-0 grid place-items-center text-xl text-white bg-white/30">
                {running ? "Capturing…" : "Starting camera…"}
              </div>
            )}

            {count > 0 && (
              <div className="absolute inset-0 grid place-items-center bg-black/30">
                <span className="text-[8rem] font-bold leading-none text-white drop-shadow-lg tabular-nums">
                  {count}
                </span>
              </div>
            )}

            {flash && <div className="absolute inset-0 animate-pulse bg-white" />}

            {running && (
              <div className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Shot {current + 1} / {PHOTO_COUNT}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls + thumbnails */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Countdown timer
                </span>
                <div className="flex gap-2">
                  {TIMER_OPTIONS.map( ( t ) => (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={timer === t ? "default" : "outline"}
                      disabled={running || phase === "composing"}
                      onClick={() => setTimer( t )}
                    >
                      {t}s
                    </Button>
                  ) )}
                </div>
              </div>

              <Progress value={( photos.length / PHOTO_COUNT ) * 100} />

              <div className="flex gap-2">
                <Button className="flex-1"
                  onClick={capturePhoto}
                >
                    Capture photo
                </Button>
                {/* {idle || phase === "error" ? (
                  <Button className="flex-1"
                    onClick={run}
                  >
                    Start session
                  </Button>
                ) : phase === "done" ? (
                  <Button className="flex-1"
                    onClick={run}
                  >
                    Retake
                  </Button>
                ) : (
                  <Button className="flex-1"
                    variant="secondary"
                    disabled
                  >
                    {phase === "composing" ? "Composing…" : "In progress…"}
                  </Button>
                )}
                <Button variant="outline"
                  onClick={reset}
                  disabled={idle}
                >
                  Reset
                </Button> */}
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-2">
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

      {/* Result strip */}
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
                onClick={run}
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
