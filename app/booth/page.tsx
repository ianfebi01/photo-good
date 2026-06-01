'use client'

import { useEffect, useMemo } from 'react'

import { type ClientFrame } from '@/lib/photobooth/frames.client'
import { useBoothStore, getBoothStep } from '@/store/boothStore'

import { BoothStepper } from '@/components/booth/BoothStepper'
import { CameraBadge } from '@/components/booth/CameraBadge'
import { StepCapture } from '@/components/booth/StepCapture'
import { StepResult } from '@/components/booth/StepResult'
import { StepSelectFrame } from '@/components/booth/StepSelectFrame'

export default function BoothPage() {
  const { frames, frameKey, started, strip, setStatus, setFrames } =
    useBoothStore()

  const frame = useMemo(
    () => frames.find( ( f ) => f.key === frameKey ) ?? frames[0],
    [frames, frameKey],
  )
  const step = useMemo( () => getBoothStep( { started, strip } ), [started, strip] )
  const status = useBoothStore( ( s ) => s.status )

  useEffect( () => {
    fetch( '/api/camera/status' )
      .then( ( r ) => r.json() )
      .then( setStatus )
      .catch( () => setStatus( { connected : false, mock : true, gphoto2 : false } ) )
  }, [setStatus] )

  useEffect( () => {
    fetch( '/api/frames' )
      .then( ( r ) => r.json() )
      .then( ( data ) => {
        if ( Array.isArray( data?.frames ) ) setFrames( data.frames as ClientFrame[] )
      } )
      .catch( () => {} )
  }, [setFrames] )

  return (
    <main className="min-h-screen bg-white xl:min-h-screen">
      <div className="container mx-auto px-4 py-8 lg:py-16 xl:h-full">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Photobooth
            </h1>
            <p className="text-sm text-muted-foreground">
              {frame?.photoCount ?? 0} shots · {frame?.label ?? '—'} frame
            </p>
          </div>
          <CameraBadge status={status} />
        </header>

        <BoothStepper step={step} />

        {step === 0 && <StepSelectFrame />}
        {step === 1 && <StepCapture />}
        {step === 2 && <StepResult />}
      </div>
    </main>
  )
}
