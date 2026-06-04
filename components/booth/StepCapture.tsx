'use client'
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type CSSProperties,
} from 'react'
import gsap from 'gsap'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBoothStore } from '@/store/boothStore'

import { CameraPreview } from './CameraPreview'
import { FilterPicker } from './FilterPicker'
import { FramePreview } from './FramePreview'
import { ShutterControls } from './ShutterControls'
import { getCSSFilter } from './filters'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
    !busy &&
    !reviewing &&
    !adjusting &&
    photoCount - photos.length > 0 &&
    countdown === null

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
  // Below xl the layout becomes a 2-step stepper (tabs); ignored at xl+ where
  // every section is shown at once.
  const [activeTab, setActiveTab] = useState<'capture' | 'edit'>( 'capture' )

  // Drives which layout renders. StepCapture only mounts client-side (step 1),
  // so reading matchMedia in the initializer is safe and avoids a flash.
  const [isXl, setIsXl] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia( '(min-width: 1280px)' ).matches,
  )

  useEffect( () => {
    const mql = window.matchMedia( '(min-width: 1280px)' )
    const onChange = () => setIsXl( mql.matches )
    onChange()
    mql.addEventListener( 'change', onChange )

    return () => mql.removeEventListener( 'change', onChange )
  }, [] )

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
    const finalAdjustments = adjustments.slice( 0, photoCount ).map( ( adj ) => ( {
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
          x : Math.max(
            -maxDx,
            Math.min( maxDx, dragStartRef.current!.initX + dx ),
          ),
          y : Math.max(
            -maxDy,
            Math.min( maxDy, dragStartRef.current!.initY + dy ),
          ),
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
          x : Math.max(
            -maxDx,
            Math.min( maxDx, dragStartRef.current!.initX + dx ),
          ),
          y : Math.max(
            -maxDy,
            Math.min( maxDy, dragStartRef.current!.initY + dy ),
          ),
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

  // GSAP-driven tab transition (below xl only — at xl every panel is shown at
  // once). Refs point at the panel(s) that belong to each step.
  const capturePanelRef = useRef<HTMLDivElement>( null )
  const filterPanelRef = useRef<HTMLDivElement>( null )
  const framePanelRef = useRef<HTMLDivElement>( null )

  useEffect( () => {
    if ( typeof window === 'undefined' ) return
    // No tab swapping at xl — skip so panels keep their static layout.
    if ( window.matchMedia( '(min-width: 1280px)' ).matches ) return

    const targets = (
      activeTab === 'capture'
        ? [capturePanelRef.current]
        : [filterPanelRef.current, framePanelRef.current]
    ).filter( Boolean ) as HTMLDivElement[]
    if ( !targets.length ) return

    const ctx = gsap.context( () => {
      gsap.fromTo(
        targets,
        { autoAlpha : 0, y : 28, scale : 0.985 },
        {
          autoAlpha  : 1,
          y          : 0,
          scale      : 1,
          duration   : 0.45,
          ease       : 'power3.out',
          stagger    : 0.08,
          clearProps : 'transform',
        },
      )
    } )

    return () => ctx.revert()
  }, [activeTab] )

  // ── Shared pieces (props are identical across both layouts) ───────────────
  const shutterControls = (
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
  )

  const filterPicker = (
    <FilterPicker
      photos={photos}
      pending={pending}
      activePhoto={activePhoto}
      globalFilter={globalFilter}
      onFilterChange={setGlobalFilter}
    />
  )

  const renderCamera = ( className?: string ) => (
    <CameraPreview
      className={className}
      phase={phase}
      liveSrc={liveSrc}
      pending={pending}
      activePhoto={activePhoto}
      globalFilter={globalFilter}
      flash={flash}
    />
  )

  const errorBanner = error ? (
    <div className="shrink-0 p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 font-sans">
      {error}
    </div>
  ) : null

  // ── Desktop (xl+): filters, capture, and the strip share one 12-col grid ──
  const desktopLayout = (
    <div className="container px-4 mx-auto grow min-h-0 py-8 lg:py-16">
      <div className="grid gap-12 h-full grid-cols-12 auto-rows-fr">
        {/* Filters */}
        <div className="col-span-8 row-span-4 flex flex-col h-full">
          <div className="grid w-full max-w-5xl grow overflow-hidden rounded-3xl bg-secondary shadow-xl grid-cols-[1fr_1.1fr]">
            <div className="relative flex flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground">
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
                  Capture &amp; Edit your photos. Take shots, apply filters, and
                  adjust framing to create the perfect strip before moving to
                  the final review.
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
                {filterPicker}
              </div>
            </div>
          </div>
        </div>

        {/* Capture */}
        <div className="col-span-8 row-span-6 flex flex-row gap-12">
          {shutterControls}
          {renderCamera()}
        </div>

        {/* Frame strip */}
        {frame && (
          <FramePreview
            className="col-start-9 col-span-4 row-start-1 row-span-10 flex flex-col"
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
    </div>
  )

  // ── Below xl: 2-step stepper (1. Capture → 2. Edit) ───────────────────────
  const stepperLayout = (
    <div className="container px-4 mx-auto flex flex-col grow min-h-0 justify-center">
      {activeTab === 'capture' ? (
        <div
          ref={capturePanelRef}
          className="flex flex-col items-center gap-4 w-full"
        >
          {renderCamera( 'w-full' )}
          {shutterControls}

          {/* Captured shots, filling as you snap */}
          {photoCount > 0 && (
            <div className="grid grid-cols-2 w-full gap-2">
              {Array.from( { length : photoCount } ).map( ( _, i ) => (
                <div
                  key={i}
                  className={cn(
                    'w-full aspect-3/2 overflow-hidden rounded-md border',
                    i === photos.length && !reviewing
                      ? 'border-primary'
                      : 'border-neutral-200',
                  )}
                >
                  {photos[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photos[i].url}
                      alt={`Shot ${i + 1}`}
                      className="h-full w-full object-cover"
                      style={{ filter : getCSSFilter( globalFilter ) }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-accent text-[10px] font-bold text-neutral-400">
                      {i + 1}
                    </div>
                  )}
                </div>
              ) )}
            </div>
          )}
        </div>
      ) : (
        // Strip fills the height left above the docked filter bar; aspect ratio
        // turns that height into the width.
        <div className="flex grow items-center justify-center min-h-0">
          {frame && (
            <FramePreview
              rootRef={framePanelRef}
              style={
                {
                  '--frame-ar' : `${frame.width} / ${frame.height}`,
                } as CSSProperties
              }
              className="flex flex-col h-full max-w-full aspect-(--frame-ar)"
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
      )}
    </div>
  )

  // Bottom Back/Next bar — drives the stepper between its two steps
  const stepperNav = (
    <div className="flex justify-between px-4 pt-4">
      <Button
        size="lg"
        variant="outline"
        onClick={
          activeTab === 'capture' ? reset : () => setActiveTab( 'capture' )
        }
        disabled={busy || !frame}
      >
        <ChevronLeft /> Back
      </Button>
      {activeTab === 'capture' ? (
        <Button
          size="lg"
          onClick={() => setActiveTab( 'edit' )}
          disabled={!frame || photos.length < photoCount}
        >
          Next <ChevronRight />
        </Button>
      ) : (
        <Button size="lg"
          onClick={handleCompose}
          disabled={!adjusting}
        >
          Finish <ChevronRight />
        </Button>
      )}
    </div>
  )

  // Full-width filter bar docked at the bottom of the edit step (mobile navbar
  // style). Lives outside the padded container so it spans the full width.
  const filterBar = (
    <div
      ref={filterPanelRef}
      className="w-full shrink-0 h-28 overflow-hidden bg-white px-4 pt-2 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] flex flex-col"
    >
      <h1 className="text-md font-bold text-foreground mb-2">Apply filters</h1>
      {filterPicker}
    </div>
  )

  return (
    <div className="flex flex-col gap-6 grow">
      {!isXl && stepperNav}
      {isXl ? desktopLayout : stepperLayout}
      {errorBanner}
      {!isXl && activeTab === 'edit' && filterBar}
    </div>
  )
}
