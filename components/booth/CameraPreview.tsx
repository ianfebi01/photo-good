import { Camera } from 'lucide-react'

import type { Phase, Shot } from '@/store/boothStore'
import { LiveStream } from './LiveStream'
import { getCSSFilter } from './filters'

interface CameraPreviewProps {
  phase: Phase
  liveSrc: string
  pending: Shot | null
  activePhoto: Shot | null
  globalFilter: string
  flash: boolean
}

export function CameraPreview( {
  phase,
  liveSrc,
  pending,
  activePhoto,
  globalFilter,
  flash,
}: CameraPreviewProps ) {
  const showStream = phase !== 'reviewing' && phase !== 'adjusting'
  const running = phase === 'running'
  const composing = phase === 'composing'

  return (
    <div className="relative aspect-3/2 overflow-hidden rounded-3xl hover:shadow-xl transition-all duration-300 ease-in-out">
      {showStream ? (
        <LiveStream
          src={liveSrc}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : pending ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pending.url}
          alt="Captured photo preview"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : activePhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activePhoto.url}
          alt="Active slot photo preview"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter : getCSSFilter( globalFilter ) }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900 text-neutral-500">
          <Camera className="size-10 text-neutral-600 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider uppercase font-sans">
            Camera Standby
          </span>
        </div>
      )}

      {flash && (
        <div className="absolute inset-0 bg-white animate-fade-out z-30" />
      )}

      {running && (
        <div className="absolute inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center text-white z-20">
          <div className="flex flex-col items-center gap-2 animate-pulse">
            <div className="size-2 bg-primary rounded-full animate-ping" />
            <span className="text-sm font-bold tracking-wider uppercase font-sans">
              Capturing Memory...
            </span>
          </div>
        </div>
      )}

      {composing && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
          <div className="flex flex-col items-center gap-3">
            <span className="size-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-bold tracking-wider uppercase font-sans">
              Composing photo strip...
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
