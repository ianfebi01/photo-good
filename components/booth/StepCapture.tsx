import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useBoothStore } from '@/store/boothStore'

export function StepCapture() {
  const {
    frameKey,
    photos,
    phase,
    pending,
    flash,
    streamKey,
    error,
    frames,
    acceptPending,
    retakePending,
    takeShot,
    reset,
  } = useBoothStore()

  const frame = frames.find( ( f ) => f.key === frameKey ) ?? frames[0]
  const photoCount = frame?.photoCount ?? 0
  const liveSrc = useMemo(
    () => `/api/camera/stream?key=${streamKey}`,
    [streamKey],
  )

  const running = phase === 'running'
  const reviewing = phase === 'reviewing'
  const composing = phase === 'composing'
  const done = phase === 'done'
  const busy = running || composing

  const remaining = photoCount - photos.length
  const canCapture = !busy && !reviewing && remaining > 0
  const thumbCols =
    photoCount <= 2
      ? 'grid-cols-1'
      : photoCount === 3
        ? 'grid-cols-3'
        : 'grid-cols-2'

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        {/* Camera preview */}
        <Card className="overflow-hidden p-0">
          <CardContent className="relative aspect-[3/2] bg-foreground p-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={streamKey}
              src={liveSrc}
              alt="Live camera preview"
              className="absolute inset-0 h-full w-full object-cover"
            />

            {pending && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pending.url}
                alt="Captured photo preview"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {running && (
              <div className="absolute inset-0 grid place-items-center bg-black/30 text-xl text-white">
                {pending ? 'Retaking…' : 'Capturing…'}
              </div>
            )}

            {composing && (
              <div className="absolute inset-0 grid place-items-center bg-black/30 text-xl text-white">
                Composing…
              </div>
            )}

            {flash && (
              <div className="absolute inset-0 animate-pulse bg-white" />
            )}

            {photos.length > 0 && !done && (
              <div className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                {photos.length} / {photoCount}
              </div>
            )}

            {reviewing && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-linear-to-t from-black/70 to-transparent px-3 py-4">
                <Button onClick={acceptPending}>Keep this shot</Button>
                <Button variant="secondary"
                  onClick={retakePending}
                >
                  Retake
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls + thumbnails */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <Progress
                value={photoCount > 0 ? ( photos.length / photoCount ) * 100 : 0}
              />

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => takeShot()}
                  disabled={!canCapture}
                >
                  {composing
                    ? 'Composing…'
                    : running
                      ? 'Capturing…'
                      : reviewing
                        ? 'Review the shot above'
                        : remaining === 0
                          ? 'All shots taken'
                          : `Capture photo (${remaining} left)`}
                </Button>
                <Button variant="outline"
                  onClick={reset}
                  disabled={busy}
                >
                  ← Back
                </Button>
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>

          <div className={`grid gap-2 ${thumbCols}`}>
            {Array.from( { length : photoCount } ).map( ( _, i ) => {
              const shot = photos[i]
              const isPending = !shot && reviewing && i === photos.length
              const src = shot?.url ?? ( isPending ? pending?.url : undefined )

              return (
                <div
                  key={i}
                  className="relative aspect-[3/2] overflow-hidden rounded-md border bg-muted"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={`Shot ${i + 1}`}
                      className={`h-full w-full object-cover ${isPending ? 'opacity-60' : ''}`}
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                  )}
                  {isPending && (
                    <span className="absolute right-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Pending
                    </span>
                  )}
                </div>
              )
            } )}
          </div>
        </div>
      </div>
    </div>
  )
}
