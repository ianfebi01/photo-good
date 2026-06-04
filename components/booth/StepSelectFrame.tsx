import { Button } from '@/components/ui/button'
import { type ClientFrame } from '@/lib/photobooth/frames.client'
import { useBoothStore } from '@/store/boothStore'
import { FrameSelector } from './FrameSelector'
import { ChevronRight } from 'lucide-react'

export function StepSelectFrame() {
  const {
    frames,
    frameKey,
    selectFrame,
    start,
    addFrame,
  } = useBoothStore()

  const frame = frames.find( ( f ) => f.key === frameKey ) ?? frames[0]

  return (
    <div className="container mx-auto px-4 py-8 lg:py-16 flex flex-col gap-6 grow overflow-hidden">
      <div className="flex justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-neutral-800 font-sans">
            Select Frame Template
          </span>
          <span className="text-xs text-neutral-400 font-sans">
            Click the stack or use the arrows to choose a template
          </span>
        </div>
        <Button
          size="lg"
          onClick={start}
          disabled={!frame}
        >
          Start session <ChevronRight/>
        </Button>
      </div>
      <FrameSelector
        frames={frames}
        active={frameKey}
        disabled={false}
        onSelect={selectFrame}
        onAdd={( f: ClientFrame ) => addFrame( f )}
      />
    </div>
  )
}
