'use client'

import { forwardRef, useEffect, useRef } from 'react'

export const LiveStream = forwardRef<
  HTMLImageElement,
  { src: string; className?: string }
>( function LiveStream( { src, className }, ref ) {
  const innerRef = useRef<HTMLImageElement | null>( null )

  useEffect( () => {
    const img = innerRef.current
    if ( !img ) return
    img.src = ''
    img.src = src

    return () => {
      img.src = ''
    }
  }, [src] )

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={( node ) => {
        innerRef.current = node
        if ( typeof ref === 'function' ) ref( node )
        else if ( ref ) ref.current = node
      }}
      alt="Live camera preview"
      className={className}
    />
  )
} )
