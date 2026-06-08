'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Film, Images, Loader2, RefreshCw, Repeat, Clapperboard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBoothStore } from '@/store/boothStore'
import {
  generateSessionVideo,
  generateSessionLoopVideo,
} from '@/lib/photobooth/frames.query'

type GenStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'

export function StepResult() {
  const {
    strip,
    videoUrl,
    loopVideoUrl,
    frameKey,
    photos,
    sessionId,
    countdownClips,
    reset,
    setVideoUrl,
    setLoopVideoUrl,
  } = useBoothStore()

  const [videoStatus, setVideoStatus] = useState<GenStatus>(
    videoUrl ? 'ready' : 'idle',
  )
  const [loopStatus, setLoopStatus] = useState<GenStatus>(
    loopVideoUrl ? 'ready' : 'idle',
  )

  const startedRef = useRef( { video : false, loop : false } )

  // Kick off video generation after the strip is ready
  useEffect( () => {
    if ( !strip || photos.length === 0 ) return

    const files = photos.map( ( p ) => p.file )
    const cdFiles = countdownClips.map( ( c ) => c.file )

    // Countdown mashup (or image slideshow fallback)
    if ( !startedRef.current.video && !videoUrl ) {
      startedRef.current.video = true
      setVideoStatus( 'loading' )
      generateSessionVideo( { sessionId, files, countdownFiles : cdFiles, frameKey } )
        .then( ( r ) => {
          if ( r ) {
            setVideoUrl( r.url )
            setVideoStatus( 'ready' )
          } else {
            setVideoStatus( 'unavailable' )
          }
        } )
        .catch( () => setVideoStatus( 'error' ) )
    }

    // 15-second loop video from all images
    if ( !startedRef.current.loop && !loopVideoUrl ) {
      startedRef.current.loop = true
      setLoopStatus( 'loading' )
      generateSessionLoopVideo( { sessionId, files } )
        .then( ( r ) => {
          if ( r ) {
            setLoopVideoUrl( r.url )
            setLoopStatus( 'ready' )
          } else {
            setLoopStatus( 'unavailable' )
          }
        } )
        .catch( () => setLoopStatus( 'error' ) )
    }
  }, [strip, photos, sessionId, countdownClips, videoUrl, loopVideoUrl, frameKey, setVideoUrl, setLoopVideoUrl] )

  const retryVideo = () => {
    startedRef.current.video = false
    setVideoStatus( 'idle' )
    setVideoUrl( null )
  }
  const retryLoop = () => {
    startedRef.current.loop = false
    setLoopStatus( 'idle' )
    setLoopVideoUrl( null )
  }

  if ( !strip ) return null

  return (
    <div className="container mx-auto px-4 py-8 lg:py-12 grow overflow-auto scrollbar-none">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="text-center mb-10 space-y-2">
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
          Your photos are ready!
        </h2>
        <p className="text-muted-foreground text-sm lg:text-base max-w-md mx-auto">
          Download your photo strip, countdown mashup, or 15-second loop video below.
        </p>
      </div>

      {/* ── Grid: Strip (hero) + Media cards ───────────────────── */}
      <div className="flex flex-wrap gap-4">
        {/* Photo Strip */}
        <Card className='flex-1 flex flex-col justify-between'>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <Images className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">Photo Strip</CardTitle>
                <CardDescription>
                  {photos.length} photo{photos.length > 1 ? 's' : ''} • {frameKey}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={strip}
              alt="Composed photo strip"
              className="w-full rounded-lg border shadow-sm"
            />
            <a
              href={strip}
              download={`photobooth-${frameKey}.jpg`}
              className="block"
            >
              <Button variant="outline"
                size="sm"
                className="w-full"
              >
                <Download className="size-4 mr-2" />
                Download Strip
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* ── Countdown Mashup Video ───────────────────────────── */}
        <Card className='flex-1 flex flex-col justify-between'>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                <Film className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {countdownClips.length > 0
                    ? 'Countdown Mashup'
                    : 'Video Slideshow'}
                </CardTitle>
                <CardDescription>
                  {countdownClips.length > 0
                    ? `${countdownClips.length} clips combined`
                    : 'MP4 with all photos'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {videoStatus === 'loading' && (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-muted/50">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                  <span className="text-xs font-medium">
                    Rendering video&hellip;
                  </span>
                </div>
              </div>
            )}

            {( videoStatus === 'ready' && videoUrl ) && (
              <>
                <video
                  src={videoUrl}
                  controls={false}
                  autoPlay
                  loop
                  className="w-full rounded-lg border shadow-sm"
                />
                <a
                  href={videoUrl}
                  download={`photobooth-${frameKey}.mp4`}
                  className="block"
                >
                  <Button variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Download className="size-4 mr-2" />
                    Download Video
                  </Button>
                </a>
              </>
            )}

            {videoStatus === 'unavailable' && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Film className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  ffmpeg is not installed.
                  <br />
                  Install it to enable video generation.
                </p>
              </div>
            )}

            {videoStatus === 'error' && (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-sm text-destructive">
                  Failed to generate video
                </p>
                <Button variant="outline"
                  size="sm"
                  onClick={retryVideo}
                >
                  <RefreshCw className="size-3 mr-2" />
                  Retry
                </Button>
              </div>
            )}

            {videoStatus === 'idle' && (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-muted/30 border border-dashed">
                <span className="text-xs text-muted-foreground">
                  Waiting for strip&hellip;
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className='flex flex-col xl:basis-1/2'>
          {/* ── Loop Video ────────────────────────────────────────── */}
          <Card className="h-fit w-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <Repeat className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Loop Video</CardTitle>
                  <CardDescription>
                  All {photos.length} photos &bull; 0.7s each
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loopStatus === 'loading' && (
                <div className="flex aspect-3/2 items-center justify-center rounded-lg bg-muted/50">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="size-8 animate-spin" />
                    <span className="text-xs font-medium">
                    Rendering loop video&hellip;
                    </span>
                  </div>
                </div>
              )}

              {( loopStatus === 'ready' && loopVideoUrl ) && (
                <>
                  <video
                    src={loopVideoUrl}
                    controls
                    loop
                    autoPlay
                    muted
                    playsInline
                    className="w-full rounded-lg border shadow-sm aspect-3/2"
                  />
                  <a
                    href={loopVideoUrl}
                    download={`photobooth-${frameKey}-loop.mp4`}
                    className="block"
                  >
                    <Button variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Download className="size-4 mr-2" />
                    Download Loop
                    </Button>
                  </a>
                </>
              )}

              {loopStatus === 'unavailable' && (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Repeat className="size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                  ffmpeg is not installed.
                    <br />
                  Install it to enable video generation.
                  </p>
                </div>
              )}

              {loopStatus === 'error' && (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <p className="text-sm text-destructive">
                  Failed to generate loop video
                  </p>
                  <Button variant="outline"
                    size="sm"
                    onClick={retryLoop}
                  >
                    <RefreshCw className="size-3 mr-2" />
                  Retry
                  </Button>
                </div>
              )}

              {loopStatus === 'idle' && (
                <div className="flex aspect-3/2 items-center justify-center rounded-lg bg-muted/30 border border-dashed">
                  <span className="text-xs text-muted-foreground">
                  Waiting for strip&hellip;
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
          {/* ── Countdown clips ──────────────────────────────────── */}
          {countdownClips.length > 0 && (
            <Card className="mt-8 w-full grow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Clapperboard className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Raw Countdown Clips</CardTitle>
                    <CardDescription>
                      {countdownClips.length} clip{countdownClips.length > 1 ? 's' : ''} &bull; scroll to view
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='grow'>
                <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-neutral-300 h-full">
                  {countdownClips.map( ( clip, i ) => (
                    <div
                      key={clip.file}
                      className="shrink-0 max-xl:w-full xl:h-full flex flex-col gap-2"
                    >
                      <video
                        src={clip.url}
                        controls={false}
                        autoPlay
                        loop
                        className="w-full rounded-lg border"
                      />
                      <span className="text-xs font-medium text-foreground">
                        Shot {i + 1}
                      </span>
                      <a
                        href={clip.url}
                        download={`countdown-${i + 1}.webm`}
                      >
                        <Button variant="outline"
                          size="sm"
                          className="w-full h-7 text-xs"
                        >
                          <Download className="size-3 mr-1" />
                          Download
                        </Button>
                      </a>
                    </div>
                  ) )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
       
      </div>

      {/* ── Bottom actions ──────────────────────────────────────── */}
      <div className="mt-10 flex justify-center">
        <Button size="lg"
          variant="outline"
          onClick={reset}
        >
          Start new session
        </Button>
      </div>
    </div>
  )
}
