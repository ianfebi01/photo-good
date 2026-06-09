'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectCards, Autoplay } from 'swiper/modules'
import { cn } from '@/lib/utils'
import { FRAMES_QUERY_KEY, getFrames } from '@/lib/photobooth/frames.query'

import 'swiper/css'
import 'swiper/css/effect-cards'

const PAGE_SIZE = 10

const subscribe = () => () => {}

/** Skeleton shown while the frames query is still loading. */
function StackSkeleton() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="h-full w-auto max-w-[75%] aspect-[1/2.8] rounded-sm bg-neutral-100 animate-pulse shadow-lg" />
    </div>
  )
}

export default function PhotoStack( { className }: { className?: string } ) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )

  const { data, isLoading } = useQuery( {
    queryKey : [...FRAMES_QUERY_KEY, { page : 1, limit : PAGE_SIZE }],
    queryFn  : () => getFrames( { page : 1, limit : PAGE_SIZE } ),
  } )

  const previewUrls = useMemo( () => {
    const list = data?.frames
    if ( !list || list.length === 0 ) return ['/api/frames/preview?key=summer-day']

    return list.map( ( f ) => `/api/frames/preview?key=${f.key}` )
  }, [data] )

  if ( isLoading || !isClient ) {
    return (
      <div className={cn( 'p-6 relative flex items-center justify-center', className )}>
        <div className="relative w-full h-full flex items-center justify-center">
          <StackSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className={cn( 'p-6 relative flex items-center justify-center overflow-hidden', className )}>
      {previewUrls.length > 0 && (
        <Swiper
          effect="cards"
          grabCursor
          loop
          autoplay={ {
            delay                : 2500,
            disableOnInteraction : true,
            pauseOnMouseEnter    : true,
          } }
          initialSlide={3}
          modules={[EffectCards, Autoplay]}
          className="h-full w-auto max-w-[75%] mx-auto"
          style={ {
            '--swiper-navigation-color' : '#fff',
            '--swiper-pagination-color' : '#fff',
          } as React.CSSProperties }
          cardsEffect={{
            slideShadows : false,
          }}
        >
          {previewUrls.map( ( url, idx ) => (
            <SwiperSlide
              key={idx}
              className="rounded-sm overflow-visible"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`photo frame ${idx + 1}`}
                className="w-full h-full object-contain drop-shadow-xl"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </SwiperSlide>
          ) )}
        </Swiper>
      )}
      
    </div>
  )
}
