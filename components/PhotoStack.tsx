'use client'

import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { cn } from '@/lib/utils'

const FRAMES = ['/api/frames/preview?key=summer-day', '/api/frames/preview?key=good-vibes']

// back → middle → front
const STACK = [
  { rotation : -7,  scale : 0.85, y : 18, zIndex : 1 },
  { rotation : 5,  scale : 0.92, y : 9, zIndex : 2 },
  { rotation : -2,  scale : 1.00, y : 0, zIndex : 3 },
]

export default function PhotoStack( { className }: { className?: string } ) {
  const cardsRef    = useRef<HTMLDivElement[]>( [] )
  const imgRefs     = useRef<HTMLImageElement[]>( [] )
  const orderRef    = useRef( [0, 1, 2] )   // order[pos] = cardIdx (0=back, 2=front)
  const nextFrame   = useRef( 1 )
  const busy        = useRef( false )
  const [cacheBuster, setCacheBuster] = useState( '' )

  useEffect( () => {
    const timer = setTimeout( () => {
      setCacheBuster( String( Date.now() ) )
    }, 0 )

    return () => clearTimeout( timer )
  }, [] )

  useEffect( () => {
    // Set initial positions
    orderRef.current.forEach( ( cardIdx, pos ) => {
      gsap.set( cardsRef.current[cardIdx], {
        rotation : STACK[pos].rotation,
        scale    : STACK[pos].scale,
        y        : STACK[pos].y,
        zIndex   : STACK[pos].zIndex,
        x        : 0,
        opacity  : 1,
      } )
    } )

    const cycle = () => {
      if ( busy.current ) return
      busy.current = true

      const [backIdx, midIdx, frontIdx] = orderRef.current

      // Front card flies off to the right
      gsap.to( cardsRef.current[frontIdx], {
        x          : '-140%',
        rotation   : -28,
        opacity    : 0,
        duration   : 0.45,
        ease       : 'power2.in',
        onComplete : () => {
          // Update frame on the exiting card before recycling it
          imgRefs.current[frontIdx].src = `${FRAMES[nextFrame.current % FRAMES.length]}${cacheBuster ? `&t=${cacheBuster}` : ''}`
          nextFrame.current++

          // New order: old front → back, old back → middle, old middle → front
          orderRef.current = [frontIdx, backIdx, midIdx]

          // Teleport recycled card to behind-left of stack
          gsap.set( cardsRef.current[frontIdx], {
            x        : '-25%',
            opacity  : 0,
            rotation : STACK[0].rotation,
            scale    : STACK[0].scale,
            y        : STACK[0].y,
            zIndex   : 1,
          } )

          // Slide recycled card into back position
          gsap.to( cardsRef.current[frontIdx], {
            x          : 0,
            opacity    : 1,
            duration   : 0.45,
            ease       : 'power2.out',
            onComplete : () => {
              busy.current = false 
            },
          } )
        },
      } )

      // Middle → front
      gsap.to( cardsRef.current[midIdx], {
        rotation : STACK[2].rotation,
        scale    : STACK[2].scale,
        y        : STACK[2].y,
        zIndex   : 3,
        duration : 0.55,
        ease     : 'power2.out',
        delay    : 0.08,
      } )

      // Back → middle
      gsap.to( cardsRef.current[backIdx], {
        rotation : STACK[1].rotation,
        scale    : STACK[1].scale,
        y        : STACK[1].y,
        zIndex   : 2,
        duration : 0.55,
        ease     : 'power2.out',
        delay    : 0.14,
      } )
    }

    const id = setInterval( cycle, 3000 )
    
    return () => {
      clearInterval( id )
      gsap.killTweensOf( cardsRef.current )
    }
  }, [cacheBuster] )

  // Initial frame assignment per card slot
  const initFrames = [FRAMES[0], FRAMES[1], FRAMES[0]]

  return (
    <div
      className={cn(
        'p-6',
        'relative flex items-center justify-center overflow-visible',
        className
      )}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {[0, 1, 2].map( ( cardIdx ) => (
          <div
            key={cardIdx}
            ref={( el ) => {
              if ( el ) cardsRef.current[cardIdx] = el 
            }}
            className="absolute inset-0 bg-transparent rounded-sm w-fit mx-auto shadow-2xl"
            style={{ transformOrigin : 'center bottom' }}
          >
            {/* Photo area */}
            <div className="w-fit h-full overflow-hidden rounded-sm">
              <img
                ref={( el ) => {
                  if ( el ) imgRefs.current[cardIdx] = el 
                }}
                src={`${initFrames[cardIdx]}${cacheBuster ? `&t=${cacheBuster}` : ''}`}
                alt="photo frame"
                className="w-full h-full object-contain"
              />
            </div>
            {/* Caption strip */}
            {/* <div className="absolute bottom-0 inset-x-0 h-9 flex items-center justify-center">
              <span className="text-[10px] tracking-widest text-gray-400 uppercase">photo good</span>
            </div> */}
          </div>
        ) )}
      </div>
    </div>
  )
}
