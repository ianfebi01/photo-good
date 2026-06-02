'use client'

import { useEffect } from 'react'

import { type ClientFrame } from '@/lib/photobooth/frames.client'
import { useBoothStore } from '@/store/boothStore'

import { StepCapture } from '@/components/booth/StepCapture'
import { StepResult } from '@/components/booth/StepResult'
import { StepSelectFrame } from '@/components/booth/StepSelectFrame'

export default function BoothPage() {
  const { step, setStatus, setFrames, restartPreview } = useBoothStore()

  useEffect( () => {
    let prevConnected: boolean | null = null

    const checkStatus = () => {
      fetch( '/api/camera/status' )
        .then( ( r ) => r.json() )
        .then( ( s ) => {
          if ( prevConnected !== null && prevConnected !== s.connected ) {
            restartPreview()
          }
          prevConnected = s.connected
          setStatus( s )
        } )
        .catch( () => setStatus( { connected : false, mock : true, gphoto2 : false } ) )
    }

    checkStatus()
    const interval = setInterval( checkStatus, 4_000 )

    return () => clearInterval( interval )
  }, [setStatus, restartPreview] )

  useEffect( () => {
    fetch( '/api/frames' )
      .then( ( r ) => r.json() )
      .then( ( data ) => {
        if ( Array.isArray( data?.frames ) ) setFrames( data.frames as ClientFrame[] )
      } )
      .catch( () => {} )
  }, [setFrames] )

  return (
    <main className="">
      <div className="min-h-screen bg-white xl:min-h-[unset] xl:h-screen overflow-hidden container mx-auto px-4 py-8 lg:py-16 flex flex-col">
        {/* <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Photobooth
            </h1>
            <p className="text-sm text-muted-foreground">
              {frame?.photoCount ?? 0} shots · {frame?.label ?? '—'} frame
            </p>
          </div>
          <CameraBadge status={status} />
        </header> */}

        {step === 0 && <StepSelectFrame />}
        {step === 1 && <StepCapture />}
        {step === 2 && <StepResult />}
      </div>
    </main>
  )
}
