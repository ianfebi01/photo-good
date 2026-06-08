'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useBoothStore } from '@/store/boothStore'
import {
  FRAMES_QUERY_KEY,
  CAMERA_STATUS_QUERY_KEY,
  getCameraStatus,
  getAllFrames,
  ensureCameraDiscovered,
} from '@/lib/photobooth/frames.query'

import { StepCapture } from '@/components/booth/StepCapture'
import { StepResult } from '@/components/booth/StepResult'
import { StepSelectFrame } from '@/components/booth/StepSelectFrame'

export function BoothClient() {
  const { step, setStatus, setFrames, restartPreview } = useBoothStore()
  const statusRef = useRef<boolean | null>( null )
  const initialLoadRef = useRef( true )

  // Kick off camera service discovery as early as possible so the stream URL
  // gets updated to the local service once detection completes.
  useEffect( () => {
    ensureCameraDiscovered().then( () => restartPreview() );
  }, [restartPreview] );

  const framesQuery = useQuery( {
    queryKey  : FRAMES_QUERY_KEY,
    queryFn   : getAllFrames,
    staleTime : 1000 * 60,
  } )

  const statusQuery = useQuery( {
    queryKey        : CAMERA_STATUS_QUERY_KEY,
    queryFn         : getCameraStatus,
    staleTime       : 4_000,
    refetchInterval : 4_000,
    retry           : false,
  } )

  useEffect( () => {
    if ( Array.isArray( framesQuery.data ) ) {
      setFrames( framesQuery.data )
    }
  }, [framesQuery.data, setFrames] )

  useEffect( () => {
    if ( !statusQuery.data ) {
      if ( statusQuery.isError ) {
        setStatus( { connected : false, mock : true, gphoto2 : false } )
      }
      
      return
    }

    const status = statusQuery.data
    const isFirst = initialLoadRef.current
    initialLoadRef.current = false
    if ( isFirst || ( statusRef.current !== null && statusRef.current !== status.connected ) ) {
      restartPreview()
    }
    statusRef.current = status.connected
    setStatus( status )
  }, [statusQuery.data, statusQuery.isError, setStatus, restartPreview] )

  return (
    <main className="">
      <div className="h-screen bg-neutral-100 xl:min-h-[unset] xl:h-screen overflow-hidden flex flex-col">
        {step === 0 && <StepSelectFrame />}
        {step === 1 && <StepCapture />}
        {step === 2 && <StepResult />}
      </div>
    </main>
  )
}
