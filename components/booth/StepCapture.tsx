'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { useBoothStore } from '@/store/boothStore'
import AppCard from '@/components/AppCard'

import { CameraPreview } from './CameraPreview'
import { FilterPicker } from './FilterPicker'
import { FramePreview } from './FramePreview'
import { ShutterControls } from './ShutterControls'

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

  const reviewing = phase === 'reviewing'
  const adjusting = phase === 'adjusting'
  const busy = phase === 'running' || phase === 'composing'
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

  return (
    <div className="container px-4 mx-auto xl:h-full">
      <div className="grid gap-12 h-full grid-cols-1 md:grid-cols-6 xl:grid-cols-12 xl:auto-rows-fr">

        <AppCard className="bg-secondary text-neutral-800 p-6 flex flex-col justify-center xl:col-span-3 xl:row-span-2">
          <span className="text-[10px] font-bold text-primary/70 uppercase tracking-widest font-sans">
            Step 2 of 3
          </span>
          <span className="text-xl font-bold text-neutral-800 font-sans">
            Capture &amp; Edit
          </span>
        </AppCard>

        <AppCard className="bg-chart-2 text-neutral-800 p-6 flex flex-col justify-center xl:col-span-5 xl:row-span-4">
          <FilterPicker
            photos={photos}
            pending={pending}
            activePhoto={activePhoto}
            globalFilter={globalFilter}
            onFilterChange={setGlobalFilter}
          />
        </AppCard>

        <AppCard className="bg-accent text-secondary-foreground p-3 flex items-center xl:col-span-3 xl:row-span-2">
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
        </AppCard>

        <div className="xl:col-span-8 xl:row-span-6 flex flex-row gap-12">
          <ShutterControls
            reviewing={reviewing}
            adjusting={adjusting}
            canCapture={canCapture}
            photosTaken={photos.length}
            photoCount={photoCount}
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
