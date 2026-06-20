'use client'
import { useQuery } from '@tanstack/react-query'
import { Download, Images, Film, Clapperboard, Repeat, ImageDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  RESULTS_QUERY_KEY,
  getResults,
  type SessionResults,
} from '@/lib/photobooth/results.query'

export function ResultView( { sessionId } : { sessionId : string } ) {
  const {
    data,
    isLoading,
    error,
  } = useQuery( {
    queryKey : [...RESULTS_QUERY_KEY, sessionId],
    queryFn  : () => getResults( sessionId ),
  } )

  if ( isLoading ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
          <p className="text-sm text-muted-foreground">Loading your photos…</p>
        </div>
      </div>
    )
  }

  if ( error || !data ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center space-y-3 px-4">
          <h1 className="text-2xl font-bold text-neutral-900">Session not found</h1>
          <p className="text-sm text-muted-foreground">This session may have expired or doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  return <ResultContent data={data} />
}

function ResultContent( { data } : { data : SessionResults } ) {
  const { boothName, results } = data
  const expiresAt = results[0].expires_at
  const strip = results.find( ( r ) => r.media_type === 'strip' )
  const images = results.filter( ( r ) => r.media_type === 'image' )
  const mashup = results.find( ( r ) => r.media_type === 'mashup' )
  const countdowns = results.filter( ( r ) => r.media_type === 'countdown' )
  const loop = results.find( ( r ) => r.media_type === 'loop' )
  const frameKey = strip?.frame_key ?? loop?.frame_key ?? null

  return (
    <div className="container px-4 py-8 mx-auto overflow-auto lg:py-12 grow scrollbar-none">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-10 space-y-2 text-center">
        {boothName && (
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{boothName}</p>
        )}
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl text-foreground">
          Your photos are ready!
        </h2>
        <p className="max-w-md mx-auto text-sm text-muted-foreground lg:text-base">
          Download your photo strip, countdown mashup, or 15-second loop video below.
        </p>
        <p className="text-xs text-muted-foreground">
          Expires{' '}
          {new Date( expiresAt ).toLocaleDateString( 'en-US', {
            weekday : 'long',
            month   : 'short',
            day     : 'numeric',
            hour    : 'numeric',
            minute  : '2-digit',
          } )}
        </p>
      </div>

      {/* ── Grid: Strip (hero) + Media cards ───────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap overflow-hidden">
        {/* Photo Strip */}
        {strip && (
          <Card className="flex flex-col overflow-hidden lg:basis-[calc(50%-0.75rem)]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center rounded-lg size-8 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <Images className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Photo Strip</CardTitle>
                  <CardDescription>
                    {images.length} photo{images.length !== 1 ? 's' : ''}{frameKey ? ` • ${frameKey}` : ''}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={strip.url}
                alt="Composed photo strip"
                className="w-full border rounded-lg shadow-sm"
              />
              <a
                href={strip.url}
                download={`photobooth-${frameKey ?? 'strip'}.jpg`}
                className="block"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Download className="mr-2 size-4" />
                  Download Strip
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* ── Countdown Mashup Video ───────────────────────────── */}
        {mashup && (
          <Card className="flex flex-col lg:basis-[calc(50%-0.75rem)]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center rounded-lg size-8 bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                  <Film className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Countdown Mashup</CardTitle>
                  <CardDescription>
                    {countdowns.length > 0
                      ? `${countdowns.length} clips combined`
                      : `${images.length} photos slideshow`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <video
                autoPlay
                loop
                muted
                playsInline
                webkit-playsinline="true"
                preload="auto"
                className="w-full border rounded-lg shadow-sm"
              >
                <source
                  src={mashup.url}
                  type="video/webm"
                />
              </video>
              <a
                href={mashup.url}
                download="countdown-mashup.webm"
                className="block"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Download className="mr-2 size-4" />
                  Download Video
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:basis-full overflow-hidden">
          {/* ── Loop Video ──────────────────────────────────────── */}
          {loop && (
            <Card className="flex flex-col lg:grow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center rounded-lg size-8 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                    <Repeat className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Loop Video</CardTitle>
                    <CardDescription>
                      All {images.length} photos &bull; 0.7s each
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <video
                  loop
                  autoPlay
                  muted
                  playsInline
                  webkit-playsinline="true"
                  preload="auto"
                  className="w-full border rounded-lg shadow-sm"
                  style={{ aspectRatio : '3/2', height : 'auto' }}
                >
                  <source
                    src={loop.url}
                    type="video/webm"
                  />
                </video>
                <a
                  href={loop.url}
                  download={`photobooth-${frameKey ?? 'session'}-loop.webm`}
                  className="block"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Download className="mr-2 size-4" />
                    Download Loop
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}

          {/* ── Countdown Clips ────────────────────────────────── */}
          {countdowns.length > 0 && (
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center rounded-lg size-8 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Clapperboard className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Raw Countdown Clips</CardTitle>
                    <CardDescription>
                      {countdowns.length} clip{countdowns.length > 1 ? 's' : ''} &bull; scroll to view
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-hidden grow">
                <div className="flex h-full gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-300">
                  {countdowns.map( ( clip, i ) => (
                    <div
                      key={clip.url}
                      className="h-full rounded-lg shadow-sm relative min-h-50"
                      style={{ aspectRatio : 3 / 2, width : 'auto' }}
                    >
                      <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        webkit-playsinline="true"
                        preload="auto"
                        className="w-full h-full object-cover rounded-lg"
                      >
                        <source
                          src={clip.url}
                          type="video/webm"
                        />
                      </video>
                      <div className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-4 text-white rounded-b-lg overflow-hidden">
                        <div className="absolute w-full bottom-0 bg-linear-to-t from-black/50 to-transparent h-full z-0" />
                        <div className="flex items-center justify-between relative z-1 w-full pb-2 pt-8 px-4">
                          <span className="text-lg font-medium">Clip {i + 1}</span>
                          <a
                            href={clip.url}
                            download={`countdown-${i + 1}.webm`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8"
                            >
                              <Download className="size-6" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    </div>
                  ) )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Raw Photos ───────────────────────────────────────── */}
        {images.length > 0 && (
          <Card className="flex flex-col overflow-hidden lg:basis-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center rounded-lg size-8 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  <ImageDown className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Raw Photos</CardTitle>
                  <CardDescription>
                    {images.length} photo{images.length > 1 ? 's' : ''} &bull; click to download
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map( ( img, i ) => (
                  <a
                    key={img.url}
                    href={img.url}
                    download={`photo-${i + 1}.jpg`}
                    className="group relative overflow-hidden rounded-lg border border-neutral-200 hover:border-neutral-400 transition shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`Photo ${i + 1}`}
                      className="w-full aspect-3/2 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                      <Download className="size-5 text-white opacity-0 group-hover:opacity-100 transition drop-shadow-lg" />
                    </div>
                  </a>
                ) )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
