'use client'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

const photos = [
  {
    src     : 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80&fit=crop&crop=top',
    tagline : 'Snap it. Tag it.',
    hashtag : '#PhotoGood',
    desc    : 'Capture your best moments in every frame.',
  },
  {
    src     : 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80&fit=crop&crop=top',
    tagline : 'Frame by frame.',
    hashtag : '#GoodShots',
    desc    : 'Every perspective deserves to be seen.',
  },
  {
    src     : 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80&fit=crop&crop=top',
    tagline : 'Be the moment.',
    hashtag : '#LiveInFrame',
    desc    : 'Light, shadow, and a perfect instant.',
  },
  {
    src     : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80&fit=crop&crop=top',
    tagline : 'Tell your story.',
    hashtag : '#ClickGood',
    desc    : 'One click can change everything.',
  },
]

export default function PhotoboothCard() {
  const photoRefs  = useRef<( HTMLDivElement | null )[]>( [] )
  const captionRef = useRef<HTMLDivElement>( null )
  const [index, setIndex] = useState( 0 )

  useEffect( () => {
    const ctx = gsap.context( () => {
      gsap.set( photoRefs.current.slice( 1 ), { autoAlpha : 0 } )

      const hold       = 3.5
      const fadeDur    = 0.8
      const captionDur = 0.35

      const tl = gsap.timeline( { repeat : -1 } )

      photos.forEach( ( _, i ) => {
        const next = ( i + 1 ) % photos.length

        tl.to( {}, { duration : hold } )

        // Caption exit
        tl.to( captionRef.current, {
          autoAlpha : 0,
          y         : 16,
          duration  : captionDur,
          ease      : 'power2.in',
        } )

        // Photo crossfade + update index
        tl.to( photoRefs.current[i], { autoAlpha : 0, duration : fadeDur, ease : 'power2.inOut' }, '<' )
        tl.to(
          photoRefs.current[next],
          {
            autoAlpha : 1,
            duration  : fadeDur,
            ease      : 'power2.inOut',
            onStart   : () => setIndex( next ),
          },
          '<',
        )

        // Caption enter
        tl.fromTo(
          captionRef.current,
          { autoAlpha : 0, y : -16 },
          { autoAlpha : 1, y : 0, duration : captionDur, ease : 'power2.out' },
        )
      } )
    } )

    return () => ctx.revert()
  }, [] )

  return (
    <div className="relative w-full h-full min-h-64">
      {/* Photos stacked */}
      {photos.map( ( photo, i ) => (
        <div
          key={i}
          ref={( el ) => {
            photoRefs.current[i] = el 
          }}
          className="absolute inset-0"
        >
          <Image
            src={photo.src}
            alt={photo.hashtag}
            fill
            className="object-cover object-top"
            priority={i === 0}
          />
        </div>
      ) )}

      {/* Brand overlay */}
      <div className="absolute top-4 right-5 text-white text-sm font-semibold tracking-tight drop-shadow-md select-none z-10">
        photo good.<sup className="text-[10px]">™</sup>
      </div>

      {/* Caption */}
      <div ref={captionRef}
        className="absolute bottom-0 left-0 right-0 z-10"
      >
        <div className="mx-3 mb-3 bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <span className="text-foreground font-bold text-base">{photos[index].tagline}</span>
            <span className="text-accent font-bold text-base">{photos[index].hashtag}</span>
          </div>
          <p className="text-muted-foreground text-[11px] leading-snug text-right max-w-[120px] mt-0.5">
            {photos[index].desc}
          </p>
        </div>
        <div className="h-2 bg-accent rounded-b-3xl mx-0" />
      </div>
    </div>
  )
}
