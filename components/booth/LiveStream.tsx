'use client'

import { useEffect, useRef } from 'react'

export function LiveStream( { src, className }: { src: string; className?: string } ) {
  const imgRef = useRef<HTMLImageElement>( null )

  useEffect( () => {
    const img = imgRef.current
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
      ref={imgRef}
      alt="Live camera preview"
      className={className}
    />
  )
}
