import { Button } from '@/components/ui/button'
import { type ClientFrame } from '@/lib/photobooth/frames.client'
import { FramePhotoStack } from './FramePhotoStack'
import { AddFrameDialog } from './AddFrameDialog'

export function FrameSelector( {
  frames,
  active,
  disabled,
  onSelect,
  onAdd,
}: {
  frames: ClientFrame[]
  active: string
  disabled: boolean
  onSelect: ( key: string ) => void
  onAdd: ( frame: ClientFrame ) => void
} ) {
  return (
    <div className="flex flex-col gap-6 grow overflow-hidden items-center">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 w-full shrink-0 max-w-2xl">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-neutral-800 font-sans">
            Select Frame Template
          </span>
          <span className="text-xs text-neutral-400 font-sans">
            Click the stack or use the arrows to choose a template
          </span>
        </div>
        <AddFrameDialog
          onUploaded={onAdd}
          trigger={
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className="font-sans text-xs border-neutral-200 hover:bg-neutral-50 shadow-sm"
            >
              + Add custom frame
            </Button>
          }
        />
      </div>

      {/* Main Stack Workspace - Transparent, centered, no backgrounds or borders */}
      <div className="w-full max-w-2xl flex-1 flex items-center justify-center overflow-visible relative">
        <FramePhotoStack
          frames={frames}
          activeKey={active}
          onSelect={onSelect}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
