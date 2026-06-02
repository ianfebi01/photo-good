import { Check, RotateCcw } from 'lucide-react'

interface ShutterControlsProps {
  reviewing: boolean
  adjusting: boolean
  canCapture: boolean
  photosTaken: number
  photoCount: number
  onRetake: () => void
  onAccept: () => void
  onCompose: () => void
  onSnap: () => void
}

export function ShutterControls( {
  reviewing,
  adjusting,
  canCapture,
  photosTaken,
  photoCount,
  onRetake,
  onAccept,
  onCompose,
  onSnap,
}: ShutterControlsProps ) {
  return (
    <div className="grow">
      <div className="pointer-events-none absolute -top-10 -right-10 h-20 w-20 rounded-full bg-primary/5 blur-xl" />

      {reviewing ? (
        <div className="flex flex-col items-center justify-center h-full w-full relative z-10 gap-4">
          <span className="text-[10px] font-black text-primary uppercase tracking-wider font-sans">
            Accept?
          </span>
          <div className="flex gap-2">
            <button
              onClick={onRetake}
              className="p-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 bg-white text-neutral-600 cursor-pointer flex items-center justify-center transition focus:outline-none"
              title="Retake"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              onClick={onAccept}
              className="p-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white cursor-pointer flex items-center justify-center transition focus:outline-none"
              title="Accept"
            >
              <Check className="size-4" />
            </button>
          </div>
        </div>
      ) : adjusting ? (
        <div className="flex flex-col items-center justify-center h-full w-full relative z-10 gap-4">
          <span className="text-[10px] font-black text-primary uppercase tracking-wider font-sans">
            Ready!
          </span>
          <button
            onClick={onCompose}
            className="group relative flex h-20 w-20 items-center justify-center cursor-pointer select-none rounded-full focus:outline-none"
            title="Compose"
          >
            <span className="absolute inset-0 rounded-full border-[3px] border-primary" />
            <span className="absolute inset-1.5 rounded-full bg-primary transition-transform duration-150 group-hover:scale-105 group-active:scale-90" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full w-full relative z-10 gap-4">
          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-sans">
            {photosTaken}/{photoCount} Shots
          </span>
          <button
            onClick={onSnap}
            disabled={!canCapture}
            className="group relative flex h-20 w-20 items-center justify-center cursor-pointer disabled:cursor-not-allowed select-none rounded-full focus:outline-none disabled:opacity-50"
            title="Snap"
          >
            <span className="absolute inset-0 rounded-full border-[3px] border-primary" />
            <span className="absolute inset-1.5 rounded-full bg-primary transition-transform duration-150 group-hover:scale-105 group-active:scale-90 group-disabled:scale-100" />
          </button>
        </div>
      )}
    </div>
  )
}
