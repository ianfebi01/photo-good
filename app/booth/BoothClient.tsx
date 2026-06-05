'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { type ClientFrame } from '@/lib/photobooth/frames.client'
import { getFrames, FRAMES_QUERY_KEY } from '@/lib/photobooth/frames.query'
import { useBoothStore } from '@/store/boothStore'

import { StepCapture } from '@/components/booth/StepCapture'
import { StepResult } from '@/components/booth/StepResult'
import { StepSelectFrame } from '@/components/booth/StepSelectFrame'

export function BoothClient() {
  const { step, setStatus, setFrames, restartPreview } = useBoothStore()

  const { data: frames } = useQuery<ClientFrame[]>({
    queryKey: FRAMES_QUERY_KEY,
    queryFn: getFrames,
    staleTime: 1000 * 60,
  })

  useEffect(() => {
    if (Array.isArray(frames)) {
      setFrames(frames)
    }
  }, [frames, setFrames])

  useEffect(() => {
    let prevConnected: boolean | null = null

    const checkStatus = () => {
      fetch('/api/camera/status')
        .then((r) => r.json())
        .then((s) => {
          if (prevConnected !== null && prevConnected !== s.connected) {
            restartPreview()
          }
          prevConnected = s.connected
          setStatus(s)
        })
        .catch(() => setStatus({ connected: false, mock: true, gphoto2: false }))
    }

    checkStatus()
    const interval = setInterval(checkStatus, 4_000)

    return () => clearInterval(interval)
  }, [setStatus, restartPreview])

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
