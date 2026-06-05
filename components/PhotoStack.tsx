'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import { cn } from '@/lib/utils'
import { FRAMES_QUERY_KEY, getFrames } from '@/lib/photobooth/frames.query'

const PAGE_SIZE = 5

// back → middle → front
const STACK = [
  { rotation : -7,  scale : 0.85, y : 18, zIndex : 1 },
  { rotation : 5,  scale : 0.92, y : 9, zIndex : 2 },
  { rotation : -2,  scale : 1.00, y : 0, zIndex : 3 },
]

/** Skeleton shown while the frames query is still loading — mimics the 3-card stack layout. */
function StackSkeleton() {
  return (
    <>
      {[
        { rotation : -7, scale : 0.85, y : 18, zIndex : 1 },
        { rotation : 5, scale : 0.92, y : 9, zIndex : 2 },
        { rotation : -2, scale : 1.00, y : 0, zIndex : 3 },
      ].map( ( layer, i ) => (
        <div
          key={i}
          className="absolute rounded-sm shadow-lg"
          style={ {
            width       : '75%',
            aspectRatio : '1 / 2.8',
            transform   : `rotate(${layer.rotation}deg) scale(${layer.scale})`,
            top         : `${layer.y}px`,
            zIndex      : layer.zIndex,
            background  : i === 2
              ? 'linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 50%, #f5f5f5 100%)'
              : '#f0f0f0',
          } }
        >
        </div>
      ) )}

      <div
        className="absolute z-10"
      >
        <div className="size-5 rounded-full border-2 border-neutral-300 border-t-transparent animate-spin" />
      </div>
    </>
  )
}

export default function PhotoStack( { className }: { className?: string } ) {
  const cardsRef      = useRef<HTMLDivElement[]>( [] )
  const imgRefs       = useRef<HTMLImageElement[]>( [] )
  const orderRef      = useRef( [0, 1, 2] )
  const nextFrame     = useRef( 0 )
  const busy          = useRef( false )
  const gsapReadyRef  = useRef( false )
  const skeletonRef   = useRef<HTMLDivElement>( null )

  const { data } = useQuery( {
    queryKey : [...FRAMES_QUERY_KEY, { page : 1, limit : PAGE_SIZE }],
    queryFn  : () => getFrames( { page : 1, limit : PAGE_SIZE } ),
  } )

  // Build preview URLs from server-paginated results
  const previewUrls = useMemo( () => {
    const list = data?.frames
    if ( !list || list.length === 0 ) return ['/api/frames/preview?key=summer-day']

    return list.map( ( f ) => `/api/frames/preview?key=${f.key}` )
  }, [data] )

  const [cacheBuster, setCacheBuster] = useState( '' )

  useEffect( () => {
    const timer = setTimeout( () => {
      setCacheBuster( String( Date.now() ) )
    }, 0 )

    return () => clearTimeout( timer )
  }, [] )

  // Assign initial images
  const initUrls = useMemo(
    () => [
      previewUrls[0],
      previewUrls[1 % previewUrls.length],
      previewUrls[0],
    ],
    [previewUrls],
  )

  useEffect( () => {
    if ( previewUrls.length === 0 ) return

    // Set initial positions & reveal cards
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

    gsapReadyRef.current = true
    skeletonRef.current?.classList.add( 'hidden' )

    // Assign initial images
    imgRefs.current[0]!.src = `${previewUrls[0]}${cacheBuster ? `&t=${cacheBuster}` : ''}`
    imgRefs.current[1]!.src = `${previewUrls[1 % previewUrls.length]}${cacheBuster ? `&t=${cacheBuster}` : ''}`
    imgRefs.current[2]!.src = `${previewUrls[0]}${cacheBuster ? `&t=${cacheBuster}` : ''}`
    nextFrame.current = 2

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
          // Update image on the exiting card before recycling it
          const idx = nextFrame.current % previewUrls.length
          imgRefs.current[frontIdx]!.src = `${previewUrls[idx]}${cacheBuster ? `&t=${cacheBuster}` : ''}`
          nextFrame.current = ( nextFrame.current + 1 ) % previewUrls.length

          // New order: old front → back, old back → middle, old middle → front
          orderRef.current = [frontIdx, backIdx, midIdx]

          // Teleport recycled card to behind-left
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
    const currentCards = cardsRef.current

    return () => {
      clearInterval( id )
      gsap.killTweensOf( currentCards )
    }
  }, [previewUrls, cacheBuster] )

  return (
    <div
      className={cn(
        'p-6',
        'relative flex items-center justify-center overflow-visible',
        className,
      )}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Skeleton overlay — hidden after GSAP initializes */}
        <div ref={skeletonRef}
          className='relative w-full h-full flex items-center justify-center'
        >
          <StackSkeleton />
        </div>

        {/* Live card stack — always rendered so GSAP can find the refs */}
        {[0, 1, 2].map( ( cardIdx ) => (
          <div
            key={cardIdx}
            ref={( el ) => {
              if ( el ) cardsRef.current[cardIdx] = el
            }}
            className="absolute inset-0 bg-transparent rounded-sm w-fit mx-auto shadow-2xl"
            style={ { transformOrigin : 'center bottom', opacity : 0, transition : 'opacity 0.4s ease' } }
          >
            <div className="w-fit h-full overflow-hidden rounded-sm relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={( el ) => {
                  if ( el ) imgRefs.current[cardIdx] = el
                }}
                src={`${initUrls[cardIdx]}${cacheBuster ? `&t=${cacheBuster}` : ''}`}
                alt="photo frame"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        ) )}
      </div>
    </div>
  )
}
