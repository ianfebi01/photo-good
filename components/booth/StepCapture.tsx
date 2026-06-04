'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { useBoothStore } from '@/store/boothStore'

import { CameraPreview } from './CameraPreview'
import { FilterPicker } from './FilterPicker'
import { FramePreview } from './FramePreview'
import { ShutterControls } from './ShutterControls'
import { ChevronLeft } from 'lucide-react';

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
  const liveSrc = useMemo(
    () => `/api/camera/stream?key=${streamKey}`,
    [streamKey],
  )

  const reviewing = phase === 'reviewing'
  const adjusting = phase === 'adjusting'
  const busy = phase === 'running' || phase === 'composing'

  const [countdown, setCountdown] = useState<number | null>( null )

  const canCapture =
    !busy && !reviewing && !adjusting && photoCount - photos.length > 0 && countdown === null

  useEffect( () => {
    if ( countdown === null ) return
    const timer = setTimeout( () => {
      if ( countdown === 1 ) {
        setCountdown( null )
        takeShot()
      } else {
        setCountdown( countdown - 1 )
      }
    }, 1000 )

    return () => clearTimeout( timer )
  }, [countdown, takeShot] )

  const [adjustments, setAdjustments] = useState<
    { x: number; y: number; zoom: number; filter: string }[]
  >( () =>
    Array.from( { length : 10 } ).map( () => ( {
      x      : 0,
      y      : 0,
      zoom   : 1.0,
      filter : 'none',
    } ) ),
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
    ( i: number ) => {
      if ( reviewing ) return i === activeSlotIdx

      return i < photos.length && adjustments[i].zoom > 1
    },
    [reviewing, activeSlotIdx, photos.length, adjustments],
  )

  // pending takes priority over stored photo when reviewing its slot
  const activePhoto =
    activeSlotIdx !== null
      ? reviewing && activeSlotIdx === targetSlotIdx
        ? pending
        : ( photos[activeSlotIdx] ?? null )
      : null

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

  const handleSnap = () => {
    setTargetSlotIdx( photos.length )
    setCountdown( 3 )
  }

  const handleAcceptPending = async () => {
    const idx = activeSlotIdx
    setSelectedSlotIdx( null )
    await acceptPending( idx ?? undefined )
  }

  const getScale = useCallback( () => {
    if ( !frameContainerRef.current ) return 1
    const el = frameContainerRef.current

    return Math.min(
      el.clientHeight / frame.height,
      ( el.parentElement?.clientWidth ?? el.clientWidth ) / frame.width,
    )
  }, [frame] )

  const handleCompose = () => {
    const scale = getScale()
    const finalAdjustments = adjustments
      .slice( 0, photoCount )
      .map( ( adj ) => ( {
        ...adj,
        filter : globalFilter,
        x      : adj.x / scale,
        y      : adj.y / scale,
      } ) )
    composeStripWithAdjustments( finalAdjustments )
  }

  const frameContainerRef = useRef<HTMLDivElement>( null )

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

  const handleZoomChange = useCallback(
    ( i: number, newZoom: number ) => {
      const clampedZoom = Math.max( 1.0, Math.min( 2.5, newZoom ) )
      setAdjustments( ( prev ) => {
        const scale = getScale()
        const slot = frame.slots[i]
        const maxDx = slot ? ( slot.width * scale * ( clampedZoom - 1 ) ) / 2 : 0
        const maxDy = slot ? ( slot.height * scale * ( clampedZoom - 1 ) ) / 2 : 0
        const next = [...prev]
        next[i] = {
          ...next[i],
          zoom : clampedZoom,
          x    : Math.max( -maxDx, Math.min( maxDx, next[i].x ) ),
          y    : Math.max( -maxDy, Math.min( maxDy, next[i].y ) ),
        }

        return next
      } )
    },
    [frame],
  )

  const handleMouseMove = useCallback(
    ( e: MouseEvent ) => {
      if ( !dragStartRef.current || activeSlotIdx === null ) return
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      const scale = getScale()
      const slot = frame.slots[activeSlotIdx]
      setAdjustments( ( prev ) => {
        const zoom = prev[activeSlotIdx].zoom
        const maxDx = slot ? ( slot.width * scale * ( zoom - 1 ) ) / 2 : 0
        const maxDy = slot ? ( slot.height * scale * ( zoom - 1 ) ) / 2 : 0
        const next = [...prev]
        next[activeSlotIdx] = {
          ...next[activeSlotIdx],
          x : Math.max( -maxDx, Math.min( maxDx, dragStartRef.current!.initX + dx ) ),
          y : Math.max( -maxDy, Math.min( maxDy, dragStartRef.current!.initY + dy ) ),
        }

        return next
      } )
    },
    [activeSlotIdx, frame, getScale],
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
      const scale = getScale()
      const slot = frame.slots[activeSlotIdx]
      setAdjustments( ( prev ) => {
        const zoom = prev[activeSlotIdx].zoom
        const maxDx = slot ? ( slot.width * scale * ( zoom - 1 ) ) / 2 : 0
        const maxDy = slot ? ( slot.height * scale * ( zoom - 1 ) ) / 2 : 0
        const next = [...prev]
        next[activeSlotIdx] = {
          ...next[activeSlotIdx],
          x : Math.max( -maxDx, Math.min( maxDx, dragStartRef.current!.initX + dx ) ),
          y : Math.max( -maxDy, Math.min( maxDy, dragStartRef.current!.initY + dy ) ),
        }

        return next
      } )
    },
    [activeSlotIdx, frame, getScale],
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

  return (
    <div className="container px-4 mx-auto xl:h-full">
      <div className="grid gap-12 h-full grid-cols-1 md:grid-cols-6 xl:grid-cols-12 xl:auto-rows-fr">

        <div className="xl:col-span-8 xl:row-span-4 flex flex-col h-full">
          <div className="grid w-full max-w-5xl grow overflow-hidden rounded-3xl bg-secondary shadow-xl md:grid-cols-[1fr_1.1fr]">
            <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground md:flex">
              <Button
                variant="link"
                className="relative z-10 text-lg font-bold text-white w-fit p-0"
                onClick={reset}
                disabled={busy}
              >
                <ChevronLeft />
                Back
              </Button>
              <div className="relative z-10 space-y-4 text-white flex flex-col">
                <span className="text-md font-bold tracking-widest font-sans">
                  Step 2 of 3
                </span>
                <span className="max-w-xs text-xs text-white/70 font-poppins">
                  Capture &amp; Edit your photos. Take shots, apply filters, and adjust framing to create the perfect strip before moving to the final review.
                </span>
              </div>
            </div>

            <div className="bg-white flex flex-col h-full overflow-hidden">
              <div className="grow pt-8 pb-4 px-8 flex flex-col">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Choose your style
                </p>
                <h1 className="my-2 text-3xl font-bold text-foreground">
                  Apply filters
                </h1>
                <FilterPicker
                  photos={photos}
                  pending={pending}
                  activePhoto={activePhoto}
                  globalFilter={globalFilter}
                  onFilterChange={setGlobalFilter}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 xl:row-span-6 flex flex-row gap-12">
          <ShutterControls
            reviewing={reviewing}
            adjusting={adjusting}
            canCapture={canCapture}
            photosTaken={photos.length}
            photoCount={photoCount}
            countdown={countdown}
            onRetake={handleRetake}
            onAccept={handleAcceptPending}
            onCompose={handleCompose}
            onSnap={handleSnap}
          />
          <CameraPreview
            phase={phase}
            liveSrc={liveSrc}
            pending={pending}
            activePhoto={activePhoto}
            globalFilter={globalFilter}
            flash={flash}
          />
        </div>

        {frame && (
          <FramePreview
            frame={frame}
            photos={photos}
            pending={pending}
            adjustments={adjustments}
            activeSlotIdx={activeSlotIdx}
            reviewing={reviewing}
            globalFilter={globalFilter}
            cacheBuster={cacheBuster}
            isSlotInteractive={isSlotInteractive}
            onSlotClick={setSelectedSlotIdx}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            containerRef={frameContainerRef}
            onZoomChange={adjusting ? handleZoomChange : undefined}
          />
        )}
      </div>

      {error && (
        <div className="shrink-0 p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 font-sans">
          {error}
        </div>
      )}
    </div>
  )
}
