'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type ClientFrame } from '@/lib/photobooth/frames.client'

const STACK = [
  { rotation : -7,  scale : 0.85, y : 18, zIndex : 1 },
  { rotation : 5,  scale : 0.92, y : 9, zIndex : 2 },
  { rotation : -2,  scale : 1.00, y : 0, zIndex : 3 },
]

export function FramePhotoStack( {
  frames,
  activeKey,
  onSelect,
  disabled = false,
}: {
  frames: ClientFrame[]
  activeKey: string
  onSelect: ( key: string ) => void
  disabled?: boolean
} ) {
  const cardsRef = useRef<HTMLDivElement[]>( [] )
  const imgRefs = useRef<HTMLImageElement[]>( [] )
  const orderRef = useRef( [0, 1, 2] ) // order[pos] = cardIdx (0=back, 2=front)
  const busy = useRef( false )
  const cardFramesRef = useRef<( ClientFrame | null )[]>( [null, null, null] )
  const [cacheBuster, setCacheBuster] = useState( '' )

  useEffect( () => {
    const timer = setTimeout( () => {
      setCacheBuster( String( Date.now() ) )
    }, 0 )

    return () => clearTimeout( timer )
  }, [] )

  const setCardFrame = useCallback( ( cardIdx: number, frame: ClientFrame | null ) => {
    cardFramesRef.current[cardIdx] = frame
    if ( imgRefs.current[cardIdx] ) {
      if ( frame ) {
        imgRefs.current[cardIdx].src = `/api/frames/preview?key=${frame.key}${cacheBuster ? `&t=${cacheBuster}` : ''}`
        imgRefs.current[cardIdx].alt = frame.label
        imgRefs.current[cardIdx].style.display = 'block'
      } else {
        imgRefs.current[cardIdx].style.display = 'none'
      }
    }
  }, [cacheBuster] )

  // Handle external selection sync
  useEffect( () => {
    if ( frames.length === 0 ) return

    const activeIdx = frames.findIndex( ( f ) => f.key === activeKey )
    const safeActiveIdx = activeIdx === -1 ? 0 : activeIdx

    const frontCardIdx = orderRef.current[2]
    const currentFrontFrame = cardFramesRef.current[frontCardIdx]

    if ( !currentFrontFrame || currentFrontFrame.key !== activeKey ) {
      // Sync stack ordering
      orderRef.current = [0, 1, 2]

      if ( frames.length >= 3 ) {
        setCardFrame( 2, frames[safeActiveIdx] )
        setCardFrame( 1, frames[( safeActiveIdx + 1 ) % frames.length] )
        setCardFrame( 0, frames[( safeActiveIdx + 2 ) % frames.length] )
      } else if ( frames.length === 2 ) {
        setCardFrame( 2, frames[safeActiveIdx] )
        setCardFrame( 1, frames[( safeActiveIdx + 1 ) % 2] )
        setCardFrame( 0, frames[safeActiveIdx] )
      } else {
        setCardFrame( 2, frames[0] )
        setCardFrame( 1, null )
        setCardFrame( 0, null )
      }

      // Instantly position elements
      [0, 1, 2].forEach( ( cardIdx ) => {
        const cardEl = cardsRef.current[cardIdx]
        if ( cardEl ) {
          const pos = orderRef.current.indexOf( cardIdx )
          const frame = cardFramesRef.current[cardIdx]
          if ( frame && pos !== -1 ) {
            gsap.set( cardEl, {
              rotation : STACK[pos].rotation,
              scale    : STACK[pos].scale,
              y        : STACK[pos].y,
              zIndex   : STACK[pos].zIndex,
              x        : 0,
              opacity  : 1,
              display  : 'block',
            } )
          } else {
            gsap.set( cardEl, { display : 'none' } )
          }
        }
      } )
    }
  }, [activeKey, frames, cacheBuster, setCardFrame] )

  const cycleNext = () => {
    if ( frames.length <= 1 || busy.current || disabled ) return
    busy.current = true

    const [backIdx, midIdx, frontIdx] = orderRef.current

    const activeIdx = frames.findIndex( ( f ) => f.key === activeKey )
    const safeActiveIdx = activeIdx === -1 ? 0 : activeIdx
    const nextActiveIdx = ( safeActiveIdx + 1 ) % frames.length

    // Front card slides out to the left
    gsap.to( cardsRef.current[frontIdx], {
      x          : '-140%',
      rotation   : -28,
      opacity    : 0,
      duration   : 0.45,
      ease       : 'power2.in',
      onComplete : () => {
        const newBackFrame = frames[( nextActiveIdx + 2 ) % frames.length]
        setCardFrame( frontIdx, newBackFrame )

        orderRef.current = [frontIdx, backIdx, midIdx]

        gsap.set( cardsRef.current[frontIdx], {
          x        : '-25%',
          opacity  : 0,
          rotation : STACK[0].rotation,
          scale    : STACK[0].scale,
          y        : STACK[0].y,
          zIndex   : STACK[0].zIndex,
        } )

        gsap.to( cardsRef.current[frontIdx], {
          x          : 0,
          opacity    : 1,
          duration   : 0.45,
          ease       : 'power2.out',
          onComplete : () => {
            busy.current = false
          },
        } )

        onSelect( frames[nextActiveIdx].key )
      },
    } )

    // Middle -> front
    gsap.to( cardsRef.current[midIdx], {
      rotation : STACK[2].rotation,
      scale    : STACK[2].scale,
      y        : STACK[2].y,
      zIndex   : STACK[2].zIndex,
      duration : 0.55,
      ease     : 'power2.out',
      delay    : 0.08,
    } )

    // Back -> middle
    gsap.to( cardsRef.current[backIdx], {
      rotation : STACK[1].rotation,
      scale    : STACK[1].scale,
      y        : STACK[1].y,
      zIndex   : STACK[1].zIndex,
      duration : 0.55,
      ease     : 'power2.out',
      delay    : 0.14,
    } )
  }

  const cyclePrev = () => {
    if ( frames.length <= 1 || busy.current || disabled ) return
    busy.current = true

    const [backIdx, midIdx, frontIdx] = orderRef.current

    const activeIdx = frames.findIndex( ( f ) => f.key === activeKey )
    const safeActiveIdx = activeIdx === -1 ? 0 : activeIdx
    const prevActiveIdx = ( safeActiveIdx - 1 + frames.length ) % frames.length

    // Recycle the back card to become the new front card
    const prevFrame = frames[prevActiveIdx]
    setCardFrame( backIdx, prevFrame )

    // Position the recycled card off-screen to the left
    gsap.set( cardsRef.current[backIdx], {
      x        : '-140%',
      rotation : -28,
      opacity  : 0,
      zIndex   : STACK[2].zIndex + 1,
    } )

    // Animate new front card flying in
    gsap.to( cardsRef.current[backIdx], {
      x          : 0,
      opacity    : 1,
      rotation   : STACK[2].rotation,
      scale      : STACK[2].scale,
      y          : STACK[2].y,
      duration   : 0.55,
      ease       : 'power2.out',
      onComplete : () => {
        gsap.set( cardsRef.current[backIdx], { zIndex : STACK[2].zIndex } )
        busy.current = false
      },
    } )

    // Old front -> middle
    gsap.to( cardsRef.current[frontIdx], {
      rotation : STACK[1].rotation,
      scale    : STACK[1].scale,
      y        : STACK[1].y,
      zIndex   : STACK[1].zIndex,
      duration : 0.55,
      ease     : 'power2.out',
    } )

    // Old middle -> back
    gsap.to( cardsRef.current[midIdx], {
      rotation : STACK[0].rotation,
      scale    : STACK[0].scale,
      y        : STACK[0].y,
      zIndex   : STACK[0].zIndex,
      duration : 0.55,
      ease     : 'power2.out',
    } )

    orderRef.current = [midIdx, frontIdx, backIdx]

    onSelect( prevFrame.key )
  }

  if ( frames.length === 0 ) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400 font-sans">
        No frames available
      </div>
    )
  }

  const activeFrame = frames.find( ( f ) => f.key === activeKey ) || frames[0]

  return (
    <div className="flex flex-col items-center gap-6 w-full h-full relative justify-center">
      {/* Interactive Stack Area */}
      <div
        className={cn(
          'relative flex items-center justify-center overflow-visible w-full h-[320px] sm:h-[400px] xl:h-[450px] select-none group/stack'
        )}
      >
        {/* Prev Arrow */}
        {frames.length > 1 && (
          <button
            type="button"
            onClick={( e ) => {
              e.stopPropagation()
              cyclePrev()
            }}
            disabled={disabled}
            className="absolute left-0 sm:left-4 z-20 p-3 rounded-full bg-white hover:bg-neutral-50 border border-neutral-200/80 shadow-md hover:shadow-lg transition cursor-pointer text-neutral-600 hover:text-neutral-900 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        {/* Next Arrow */}
        {frames.length > 1 && (
          <button
            type="button"
            onClick={( e ) => {
              e.stopPropagation()
              cycleNext()
            }}
            disabled={disabled}
            className="absolute right-0 sm:right-4 z-20 p-3 rounded-full bg-white hover:bg-neutral-50 border border-neutral-200/80 shadow-md hover:shadow-lg transition cursor-pointer text-neutral-600 hover:text-neutral-900 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="size-5" />
          </button>
        )}

        {/* Card elements (clicking stack cycles forward) */}
        <div
          onClick={cycleNext}
          className="relative w-full h-[90%] flex items-center justify-center cursor-pointer"
        >
          {[0, 1, 2].map( ( cardIdx ) => (
            <div
              key={cardIdx}
              ref={( el ) => {
                if ( el ) cardsRef.current[cardIdx] = el
              }}
              className="absolute inset-0 bg-transparent w-fit mx-auto shadow-2xl transition-shadow duration-300 hover:shadow-black/20"
              style={{ transformOrigin : 'center bottom' }}
            >
              <div className="w-fit h-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={( el ) => {
                    if ( el ) imgRefs.current[cardIdx] = el
                  }}
                  alt="photo frame"
                  className="h-full w-auto max-h-[280px] sm:max-h-[360px] md:max-h-[400px] lg:max-h-[420px] object-contain"
                />
              </div>
            </div>
          ) )}
        </div>
      </div>

      {/* Frame details at the bottom */}
      <div className="flex flex-col items-center gap-0.5 mt-2 shrink-0">
        <span className="text-base font-bold text-neutral-800 font-sans">
          {activeFrame.label}
        </span>
        <span className="text-xs text-neutral-400 font-sans">
          {activeFrame.photoCount} slot{activeFrame.photoCount !== 1 ? 's' : ''} · {activeFrame.width} × {activeFrame.height} px
        </span>
      </div>
    </div>
  )
}
