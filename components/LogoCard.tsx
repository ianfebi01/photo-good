'use client'

import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { cn } from '@/lib/utils'

const CHARS = 'Photo Good'.split( '' )
const COLORS = [ '#eb4c4c', '#f07070', '#ffa6a6' ]

export default function LogoCard( { className }: { className?: string } ) {
  const bgRef = useRef<HTMLDivElement>( null )
  const charsRef = useRef<HTMLSpanElement[]>( [] )
  const tlRef = useRef<gsap.core.Timeline | null>( null )
  const colorIndex = useRef( 0 )

  useEffect( () => {
    gsap.set( bgRef.current, {
      clipPath        : 'circle(0% at 0% 50%)',
      backgroundColor : COLORS[0],
    } )
    gsap.set( charsRef.current, { y : 8, color : '#3b1515' } )

    tlRef.current = gsap.timeline( {
      repeat   : -1,
      onRepeat : () => {
        colorIndex.current = ( colorIndex.current + 1 ) % COLORS.length
        gsap.set( bgRef.current, { backgroundColor : COLORS[colorIndex.current] } )
      },
    } )
      // Circle expands from left
      .to( bgRef.current, {
        clipPath : 'circle(150% at 0% 50%)',
        duration : 0.55,
        ease     : 'power2.inOut',
      } )
      // Text slides up + turns white (typing feel)
      .to( charsRef.current, {
        y        : 0,
        color    : '#ffffff',
        duration : 0.22,
        ease     : 'power1.out',
        stagger  : 0.045,
      }, '-=0.3' )
      // 3D effect: stroke behind white fill via paint-order + depth shadows
      .to( charsRef.current, {
        color            : '#ffffff',
        webkitTextStroke : '4px #5a0808',
        textShadow       : '2px 2px 0px #7a1a1a, 4px 4px 6px rgba(0,0,0,0.4)',
        duration         : 0.35,
        ease             : 'power2.inOut',
        stagger          : 0.03,
      } as gsap.TweenVars, '+=0.1' )
      // Settle — stroke and shadows fade out
      .to( charsRef.current, {
        webkitTextStroke : '0px transparent',
        textShadow       : 'none',
        duration         : 0.4,
        ease             : 'power1.inOut',
        stagger          : 0.02,
      } as gsap.TweenVars, '+=0.25' )
      // Text erases (reverse stagger, slide down + turns dark)
      .to( charsRef.current, {
        y        : 8,
        color    : '#3b1515',
        duration : 0.2,
        ease     : 'power1.in',
        stagger  : { each : 0.04, from : 'end' },
      }, '+=0.5' )
      // Circle contracts back to left
      .to( bgRef.current, {
        clipPath : 'circle(0% at 0% 50%)',
        duration : 0.5,
        ease     : 'power2.inOut',
      }, '-=0.1' )

    return () => {
      tlRef.current?.kill()
    }
  }, [] )

  return (
    <div
      className={cn(
        'rounded-3xl bg-white p-6',
        'hover:shadow-xl transition-all duration-300 ease-in-out',
        'relative overflow-hidden',
        'flex items-center justify-center',
        className
      )}
    >
      <div
        ref={bgRef}
        className="absolute inset-0 pointer-events-none"
        style={{ clipPath : 'circle(0% at 0% 50%)' }}
      />
      <span className="relative z-10 text-7xl font-bold text-center select-none">
        {CHARS.map( ( char, i ) => (
          <span
            key={i}
            ref={( el ) => {
              if ( el ) charsRef.current[i] = el
            }}
            className="inline-block"
            style={{ paintOrder : 'stroke fill' } as React.CSSProperties}
          >
            {char === ' ' ? ' ' : char}
          </span>
        ) )}
      </span>
    </div>
  )
}
