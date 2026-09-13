'use client'
import { useQuery } from '@tanstack/react-query'
import type { MouseEvent } from 'react'
import { Download, Images, Film, Clapperboard, Repeat, ImageDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  RESULTS_QUERY_KEY,
  getResults,
  type SessionResults,
} from '@/lib/photobooth/results.query'
import { downloadMedia } from '@/lib/photobooth/download'
import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'

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
  const stripFilename = `photobooth-${frameKey ?? 'strip'}.jpg`
  const mashupFilename = 'countdown-mashup.webm'
  const loopFilename = `photobooth-${frameKey ?? 'session'}-loop.webm`

  // `<a download>` is ignored cross-origin, so fetch the bytes and save via blob.
  const handleDownload = (
    event : MouseEvent<HTMLAnchorElement>,
    url : string,
    filename : string,
  ) => {
    event.preventDefault()

    void downloadMedia( url, filename ).catch( () => {
      // Fetch failed — fall back to the plain link so the media is still reachable.
      window.open( url, '_blank', 'noopener' )
    } )
  }

  return (
    <div className="container px-4 py-8 mx-auto overflow-auto lg:py-12 grow scrollbar-none">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-10 space-y-2 text-center font-jakarta">
        {boothName && (
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{boothName}</p>
        )}
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl text-foreground font-sans">
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
              <div className='relative aspect-4/6 overflow-hidden bg-neutral-100 flex items-center justify-center'>
                <Image
                  src={strip.url}
                  alt="Composed photo strip"
                  className="w-full h-full object-contain"
                  fill
                  quality={80}
                />
              </div>
              <a
                href={strip.url}
                download={stripFilename}
                onClick={( e ) => handleDownload( e, strip.url, stripFilename )}
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
              <div className='relative aspect-4/6 overflow-hidden bg-neutral-100 flex items-center justify-center'>
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  webkit-playsinline="true"
                  preload="auto"
                  className="w-full h-full"
                >
                  <source
                    src={mashup.url}
                    type="video/webm"
                  />
                </video>
              </div>
              <a
                href={mashup.url}
                download={mashupFilename}
                onClick={( e ) => handleDownload( e, mashup.url, mashupFilename )}
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
                <div className='relative aspect-3/2 overflow-hidden bg-neutral-100 flex items-center justify-center'>
                  <video
                    loop
                    autoPlay
                    muted
                    playsInline
                    webkit-playsinline="true"
                    preload="auto"
                    className="w-full h-full"
                    style={{ aspectRatio : '3/2', height : 'auto' }}
                  >
                    <source
                      src={loop.url}
                      type="video/webm"
                    />
                  </video>
                </div>
                <a
                  href={loop.url}
                  download={loopFilename}
                  onClick={( e ) => handleDownload( e, loop.url, loopFilename )}
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
                      {countdowns.length} clip{countdowns.length > 1 ? 's' : ''} &bull; swipe to view
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-hidden grow">
                {/* paddingBottom is inline because Swiper's own `.swiper { padding: 0 }`
                    beats utility classes — the space below holds the pagination dots. */}
                <Swiper
                  modules={[Pagination]}
                  pagination={{ clickable : true }}
                  slidesPerView={1}
                  spaceBetween={12}
                  grabCursor
                  style={{ paddingBottom : '2rem' }}
                  className="w-full [--swiper-pagination-color:#171717] [--swiper-pagination-bullet-inactive-color:#a3a3a3] [--swiper-pagination-bullet-inactive-opacity:1] [--swiper-pagination-bullet-size:6px]"
                >
                  {countdowns.map( ( clip, i ) => (
                    <SwiperSlide key={clip.url}>
                      <div className="relative aspect-3/2 overflow-hidden bg-neutral-100 flex items-center justify-center">
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          webkit-playsinline="true"
                          preload="auto"
                          className="w-full h-full object-contain"
                        >
                          <source
                            src={clip.url}
                            type="video/webm"
                          />
                        </video>
                        <div className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-4 text-white overflow-hidden">
                          <div className="absolute w-full bottom-0 bg-linear-to-t from-black/50 to-transparent h-full z-0" />
                          <div className="flex items-center justify-between relative z-1 w-full pb-2 pt-8 px-4">
                            <span className="text-md font-jakarta font-medium">Clip {i + 1}</span>
                            <a
                              href={clip.url}
                              download={`countdown-${i + 1}.webm`}
                              onClick={( e ) => handleDownload( e, clip.url, `countdown-${i + 1}.webm` )}
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
                    </SwiperSlide>
                  ) )}
                </Swiper>
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
                    onClick={( e ) => handleDownload( e, img.url, `photo-${i + 1}.jpg` )}
                    className="relative aspect-3/2 overflow-hidden bg-neutral-100 flex items-center justify-center"
                  >
                    <Image
                      src={img.url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                      fill
                      quality={30}
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
