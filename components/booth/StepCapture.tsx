'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Camera, Check, RotateCcw, Sliders } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useBoothStore } from '@/store/boothStore'
import { cn } from '@/lib/utils'

function Card( {
  className,
  children,
}: React.PropsWithChildren<{ className?: string }> ) {
  return (
    <div className={cn( 'rounded-3xl bg-white p-6 hover:shadow-xl transition-all duration-300 ease-in-out', className )}>
      {children}
    </div>
  )
}

const filtersList = [
  { name : 'none', label : 'Normal' },
  { name : 'grayscale', label : 'B&W' },
  { name : 'sepia', label : 'Sepia' },
  { name : 'warm', label : 'Warm' },
  { name : 'cool', label : 'Cool' },
  { name : 'vintage', label : 'Vintage' },
]

function getCSSFilter( filter: string ) {
  if ( filter === 'grayscale' ) return 'grayscale(1)'
  if ( filter === 'sepia' ) return 'sepia(0.8)'
  if ( filter === 'warm' ) return 'sepia(0.15) saturate(1.2) hue-rotate(-10deg)'
  if ( filter === 'cool' ) return 'saturate(0.9) hue-rotate(10deg) brightness(1.02)'
  if ( filter === 'vintage' ) return 'sepia(0.25) saturate(0.8) contrast(1.1) brightness(1.05)'
  
  return 'none'
}

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
    composeStripWithAdjustments,
  } = useBoothStore()

  const frame = frames.find( ( f ) => f.key === frameKey ) ?? frames[0]
  const photoCount = frame?.photoCount ?? 0
  const liveSrc = useMemo( () => `/api/camera/stream?key=${streamKey}`, [streamKey] )

  const running = phase === 'running'
  const reviewing = phase === 'reviewing'
  const composing = phase === 'composing'
  const adjusting = phase === 'adjusting'
  const busy = running || composing
  const canCapture = !busy && !reviewing && !adjusting && photoCount - photos.length > 0

  const [adjustments, setAdjustments] = useState<
    { x: number; y: number; zoom: number; filter: string }[]
  >( () =>
    Array.from( { length : 10 } ).map( () => ( { x : 0, y : 0, zoom : 1.0, filter : 'none' } ) ),
  )
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>( null )
  const [targetSlotIdx, setTargetSlotIdx] = useState<number | null>( null )
  const [globalFilter, setGlobalFilter] = useState<string>( 'none' )
  const [cacheBuster, setCacheBuster] = useState( '' )

  useEffect( () => {
    const timer = setTimeout( () => setCacheBuster( String( Date.now() ) ), 0 )
    
    return () => clearTimeout( timer )
  }, [] )

  const activeSlotIdx = useMemo(
    () =>
      reviewing
        ? ( targetSlotIdx ?? photos.length )
        : adjusting
          ? ( selectedSlotIdx ?? 0 )
          : selectedSlotIdx,
    [reviewing, adjusting, targetSlotIdx, photos.length, selectedSlotIdx],
  )

  const isSlotInteractive = useCallback(
    ( i: number ) => ( reviewing ? i === activeSlotIdx : i < photos.length ),
    [reviewing, activeSlotIdx, photos.length],
  )

  const handleRetake = () => {
    if ( activeSlotIdx !== null ) {
      setAdjustments( ( prev ) => {
        const next = [...prev]
        next[activeSlotIdx] = { x : 0, y : 0, zoom : 1.0, filter : 'none' }
        
        return next
      } )
    }
    setSelectedSlotIdx( null )
    retakePending()
  }

  const handleSnap = async () => {
    setTargetSlotIdx( photos.length )
    await takeShot()
  }

  const handleAcceptPending = async () => {
    const idx = activeSlotIdx
    setSelectedSlotIdx( null )
    await acceptPending( idx ?? undefined )
  }

  const handleCompose = () => {
    const finalAdjustments = adjustments
      .slice( 0, photoCount )
      .map( ( adj ) => ( { ...adj, filter : globalFilter } ) )
    composeStripWithAdjustments( finalAdjustments )
  }

  const dragStartRef = useRef<{
    x: number
    y: number
    initX: number
    initY: number
  } | null>( null )

  const handleMouseDown = ( e: React.MouseEvent, index: number ) => {
    e.preventDefault()
    setSelectedSlotIdx( index )
    dragStartRef.current = {
      x     : e.clientX,
      y     : e.clientY,
      initX : adjustments[index].x,
      initY : adjustments[index].y,
    }
  }

  const handleMouseMove = useCallback(
    ( e: MouseEvent ) => {
      if ( !dragStartRef.current || activeSlotIdx === null ) return
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      setAdjustments( ( prev ) => {
        const next = [...prev]
        next[activeSlotIdx] = {
          ...next[activeSlotIdx],
          x : dragStartRef.current!.initX + dx,
          y : dragStartRef.current!.initY + dy,
        }
        
        return next
      } )
    },
    [activeSlotIdx],
  )

  const handleMouseUp = useCallback( () => {
    dragStartRef.current = null 
  }, [] )

  const handleTouchStart = ( e: React.TouchEvent, index: number ) => {
    setSelectedSlotIdx( index )
    const touch = e.touches[0]
    dragStartRef.current = {
      x     : touch.clientX,
      y     : touch.clientY,
      initX : adjustments[index].x,
      initY : adjustments[index].y,
    }
  }

  const handleTouchMove = useCallback(
    ( e: TouchEvent ) => {
      if ( !dragStartRef.current || activeSlotIdx === null ) return
      const touch = e.touches[0]
      const dx = touch.clientX - dragStartRef.current.x
      const dy = touch.clientY - dragStartRef.current.y
      setAdjustments( ( prev ) => {
        const next = [...prev]
        next[activeSlotIdx] = {
          ...next[activeSlotIdx],
          x : dragStartRef.current!.initX + dx,
          y : dragStartRef.current!.initY + dy,
        }
        
        return next
      } )
    },
    [activeSlotIdx],
  )

  const handleTouchEnd = useCallback( () => {
    dragStartRef.current = null 
  }, [] )

  useEffect( () => {
    window.addEventListener( 'mousemove', handleMouseMove )
    window.addEventListener( 'mouseup', handleMouseUp )
    window.addEventListener( 'touchmove', handleTouchMove )
    window.addEventListener( 'touchend', handleTouchEnd )
    
    return () => {
      window.removeEventListener( 'mousemove', handleMouseMove )
      window.removeEventListener( 'mouseup', handleMouseUp )
      window.removeEventListener( 'touchmove', handleTouchMove )
      window.removeEventListener( 'touchend', handleTouchEnd )
    }
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd] )

  // pending takes priority over stored photo when reviewing its slot
  const activePhoto =
    activeSlotIdx !== null
      ? reviewing && activeSlotIdx === targetSlotIdx
        ? pending
        : ( photos[activeSlotIdx] ?? null )
      : null

  return (
    <div className="container px-4 mx-auto xl:h-full">
      <div className="grid gap-12 h-full grid-cols-1 md:grid-cols-6 xl:grid-cols-12 xl:auto-rows-fr">

        <Card className="bg-secondary text-neutral-800 p-6 flex flex-col justify-center xl:col-span-3 xl:row-span-2">
          <span className="text-[10px] font-bold text-primary/70 uppercase tracking-widest font-sans">
            Step 2 of 3
          </span>
          <span className="text-xl font-bold text-neutral-800 font-sans">
            Capture &amp; Edit
          </span>
        </Card>

        <Card className="bg-chart-2 text-neutral-800 p-6 flex flex-col justify-center xl:col-span-5 xl:row-span-4">
          <div className="flex flex-row items-center gap-6 w-full h-full">
            <div className="flex flex-col gap-1.5 flex-2 justify-center h-full overflow-hidden">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white font-sans">
                <Sliders className="size-3.5 text-white" />
                <span>Choose Color Filter</span>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-none h-full items-center">
                {filtersList.map( ( f ) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setGlobalFilter( f.name )}
                    className={cn(
                      'flex flex-col gap-1 text-center transition cursor-pointer select-none h-full w-fit!',
                      globalFilter === f.name ? 'bg-primary/2 text-black' : 'text-white',
                    )}
                  >
                    {photos.length > 0 || pending ? (
                      <div className="aspect-4/3 h-full overflow-hidden rounded-md bg-accent relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activePhoto?.url ?? photos[0]?.url ?? pending?.url}
                          alt={f.label}
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{ filter : getCSSFilter( f.name ) }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-4/3 h-full overflow-hidden rounded-md bg-accent relative flex items-center justify-center text-white">
                        {f.label}
                      </div>
                    )}
                    <span className="text-[9px] font-bold truncate w-full">
                      {f.label}
                    </span>
                  </button>
                ) )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-accent text-secondary-foreground p-3 flex items-center xl:col-span-3 xl:row-span-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={busy}
            className="group font-sans text-sm font-bold tracking-wide uppercase text-secondary-foreground hover:bg-white/10 hover:text-secondary-foreground rounded-xl px-4 py-2 cursor-pointer flex items-center gap-1.5"
          >
            <span className="transition-transform group-hover:-translate-x-1">←</span>
            Back
          </Button>
        </Card>

        <div className="xl:col-span-8 xl:row-span-6 flex flex-row gap-12">
          <div className="grow">
            <div className="pointer-events-none absolute -top-10 -right-10 h-20 w-20 rounded-full bg-primary/5 blur-xl" />

            {reviewing ? (
              <div className="flex flex-col items-center justify-center h-full w-full relative z-10 gap-4">
                <span className="text-[10px] font-black text-primary uppercase tracking-wider font-sans">
                  Accept?
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleRetake}
                    className="p-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 bg-white text-neutral-600 cursor-pointer flex items-center justify-center transition focus:outline-none"
                    title="Retake"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                  <button
                    onClick={handleAcceptPending}
                    className="p-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white cursor-pointer flex items-center justify-center transition focus:outline-none"
                    title="Accept"
                  >
                    <Check className="size-4" />
                  </button>
                </div>
              </div>
            ) : adjusting ? (
              <div className="flex flex-col items-center justify-center h-full w-full relative z-10 gap-4">
                <span className="text-[10px] font-black text-primary uppercase tracking-wider font-sans">
                  Ready!
                </span>
                <button
                  onClick={handleCompose}
                  className="group relative flex h-20 w-20 items-center justify-center cursor-pointer select-none rounded-full focus:outline-none"
                  title="Compose"
                >
                  <span className="absolute inset-0 rounded-full border-[3px] border-primary" />
                  <span className="absolute inset-1.5 rounded-full bg-primary transition-transform duration-150 group-hover:scale-105 group-active:scale-90" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full relative z-10 gap-4">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-sans">
                  {photos.length}/{photoCount} Shots
                </span>
                <button
                  onClick={handleSnap}
                  disabled={!canCapture}
                  className="group relative flex h-20 w-20 items-center justify-center cursor-pointer disabled:cursor-not-allowed select-none rounded-full focus:outline-none disabled:opacity-50"
                  title="Snap"
                >
                  <span className="absolute inset-0 rounded-full border-[3px] border-primary" />
                  <span className="absolute inset-1.5 rounded-full bg-primary transition-transform duration-150 group-hover:scale-105 group-active:scale-90 group-disabled:scale-100" />
                </button>
              </div>
            )}
          </div>

          <div className="relative aspect-3/2 overflow-hidden rounded-3xl hover:shadow-xl transition-all duration-300 ease-in-out">
            {phase !== 'reviewing' && phase !== 'adjusting' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={streamKey}
                src={liveSrc}
                alt="Live camera preview"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : pending ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pending.url}
                alt="Captured photo preview"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : activePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activePhoto.url}
                alt="Active slot photo preview"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ filter : getCSSFilter( globalFilter ) }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900 text-neutral-500">
                <Camera className="size-10 text-neutral-600 animate-pulse" />
                <span className="text-xs font-semibold tracking-wider uppercase font-sans">
                  Camera Standby
                </span>
              </div>
            )}

            {flash && (
              <div className="absolute inset-0 bg-white animate-fade-out z-30" />
            )}

            {running && (
              <div className="absolute inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center text-white z-20">
                <div className="flex flex-col items-center gap-2 animate-pulse">
                  <div className="size-2 bg-primary rounded-full animate-ping" />
                  <span className="text-sm font-bold tracking-wider uppercase font-sans">
                    Capturing Memory...
                  </span>
                </div>
              </div>
            )}

            {composing && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                <div className="flex flex-col items-center gap-3">
                  <span className="size-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-bold tracking-wider uppercase font-sans">
                    Composing photo strip...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden xl:col-start-9 xl:col-span-4 xl:row-start-1 xl:row-span-10">
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            {frame && (
              <div
                className="relative overflow-hidden max-h-full"
                style={{
                  aspectRatio : `${frame.width} / ${frame.height}`,
                  height      : '100%',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/frames/preview?key=${frame.key}&raw=true&t=${cacheBuster}`}
                  alt="Frame template"
                  className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
                />

                {activeSlotIdx !== null && frame.slots[activeSlotIdx] && (
                  <div
                    className="absolute ring-2 ring-primary ring-inset z-30 pointer-events-none animate-pulse"
                    style={{
                      left   : `${( frame.slots[activeSlotIdx].left / frame.width ) * 100}%`,
                      top    : `${( frame.slots[activeSlotIdx].top / frame.height ) * 100}%`,
                      width  : `${( frame.slots[activeSlotIdx].width / frame.width ) * 100}%`,
                      height : `${( frame.slots[activeSlotIdx].height / frame.height ) * 100}%`,
                    }}
                  />
                )}

                {frame.slots.map( ( slot, i ) => {
                  const photo = reviewing && i === activeSlotIdx ? pending : photos[i]
                  const adj = adjustments[i]
                  
                  return (
                    <div
                      key={i}
                      onClick={() => isSlotInteractive( i ) && setSelectedSlotIdx( i )}
                      onMouseDown={( e ) => isSlotInteractive( i ) && handleMouseDown( e, i )}
                      onTouchStart={( e ) => isSlotInteractive( i ) && handleTouchStart( e, i )}
                      className={cn(
                        'absolute overflow-hidden select-none z-0',
                        isSlotInteractive( i ) && 'cursor-grab active:cursor-grabbing',
                      )}
                      style={{
                        left   : `${( slot.left / frame.width ) * 100}%`,
                        top    : `${( slot.top / frame.height ) * 100}%`,
                        width  : `${( slot.width / frame.width ) * 100}%`,
                        height : `${( slot.height / frame.height ) * 100}%`,
                      }}
                    >
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.url}
                          alt={`Slot ${i + 1}`}
                          className="absolute pointer-events-none select-none max-w-none"
                          style={{
                            width     : '100%',
                            height    : '100%',
                            objectFit : 'cover',
                            transform : `translate(${adj.x}px, ${adj.y}px) scale(${adj.zoom})`,
                            filter    : getCSSFilter( globalFilter ),
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[#FFEDC7]/30 flex items-center justify-center text-xs font-bold text-neutral-400">
                          {i + 1}
                        </div>
                      )}
                    </div>
                  )
                } )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="shrink-0 p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 font-sans">
          {error}
        </div>
      )}
    </div>
  )
}
