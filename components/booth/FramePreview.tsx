import { cn } from '@/lib/utils'
import type { ClientFrame } from '@/lib/photobooth/frames.client'
import type { Shot } from '@/store/boothStore'
import { getCSSFilter } from './filters'

interface FramePreviewProps {
  frame: ClientFrame
  photos: Shot[]
  pending: Shot | null
  adjustments: { x: number; y: number; zoom: number; filter: string }[]
  activeSlotIdx: number | null
  reviewing: boolean
  globalFilter: string
  cacheBuster: string
  isSlotInteractive: ( i: number ) => boolean
  onSlotClick: ( i: number ) => void
  onMouseDown: ( e: React.MouseEvent, i: number ) => void
  onTouchStart: ( e: React.TouchEvent, i: number ) => void
}

export function FramePreview( {
  frame,
  photos,
  pending,
  adjustments,
  activeSlotIdx,
  reviewing,
  globalFilter,
  cacheBuster,
  isSlotInteractive,
  onSlotClick,
  onMouseDown,
  onTouchStart,
}: FramePreviewProps ) {
  return (
    <div className="flex flex-col overflow-hidden xl:col-start-9 xl:col-span-4 xl:row-start-1 xl:row-span-10">
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <div
          className="relative overflow-hidden max-h-full"
          style={{
            aspectRatio : `${frame.width} / ${frame.height}`,
            height      : '100%',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/frames/preview?key=${frame.key}&raw=true&t=${cacheBuster}`}
            alt="Frame template"
            className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
          />

          {activeSlotIdx !== null && frame.slots[activeSlotIdx] && (
            <div
              className="absolute ring-2 ring-primary ring-inset z-30 pointer-events-none animate-pulse"
              style={{
                left   : `${( frame.slots[activeSlotIdx].left / frame.width ) * 100}%`,
                top    : `${( frame.slots[activeSlotIdx].top / frame.height ) * 100}%`,
                width  : `${( frame.slots[activeSlotIdx].width / frame.width ) * 100}%`,
                height : `${( frame.slots[activeSlotIdx].height / frame.height ) * 100}%`,
              }}
            />
          )}

          {frame.slots.map( ( slot, i ) => {
            const photo = reviewing && i === activeSlotIdx ? pending : photos[i]
            const adj = adjustments[i]

            return (
              <div
                key={i}
                onClick={() => isSlotInteractive( i ) && onSlotClick( i )}
                onMouseDown={( e ) => isSlotInteractive( i ) && onMouseDown( e, i )}
                onTouchStart={( e ) => isSlotInteractive( i ) && onTouchStart( e, i )}
                className={cn(
                  'absolute overflow-hidden select-none z-0',
                  isSlotInteractive( i ) && 'cursor-grab active:cursor-grabbing',
                )}
                style={{
                  left   : `${( slot.left / frame.width ) * 100}%`,
                  top    : `${( slot.top / frame.height ) * 100}%`,
                  width  : `${( slot.width / frame.width ) * 100}%`,
                  height : `${( slot.height / frame.height ) * 100}%`,
                }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={`Slot ${i + 1}`}
                    className="absolute pointer-events-none select-none max-w-none"
                    style={{
                      width     : '100%',
                      height    : '100%',
                      objectFit : 'cover',
                      transform : `translate(${adj.x}px, ${adj.y}px) scale(${adj.zoom})`,
                      filter    : getCSSFilter( globalFilter ),
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-[#FFEDC7]/30 flex items-center justify-center text-xs font-bold text-neutral-400">
                    {i + 1}
                  </div>
                )}
              </div>
            )
          } )}
        </div>
      </div>
    </div>
  )
}
