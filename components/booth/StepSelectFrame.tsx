import { Button } from '@/components/ui/button'
import { type ClientFrame } from '@/lib/photobooth/frames.client'
import { useBoothStore } from '@/store/boothStore'

import { FrameSelector } from './FrameSelector'
import { FrameUploadForm } from './FrameUploadForm'

export function StepSelectFrame() {
  const {
    frames,
    frameKey,
    uploadOpen,
    selectFrame,
    setUploadOpen,
    start,
    addFrame,
  } = useBoothStore()

  const frame = frames.find( ( f ) => f.key === frameKey ) ?? frames[0]

  return (
    <div className="flex flex-col gap-6">
      <FrameSelector
        frames={frames}
        active={frameKey}
        disabled={false}
        onSelect={selectFrame}
        onAdd={() => setUploadOpen( true )}
      />

      {uploadOpen && (
        <FrameUploadForm
          onCancel={() => setUploadOpen( false )}
          onUploaded={( f: ClientFrame ) => addFrame( f )}
        />
      )}

      <div className="flex justify-end">
        <Button size="lg"
          onClick={start}
          disabled={!frame}
        >
          Start session →
        </Button>
      </div>
    </div>
  )
}
