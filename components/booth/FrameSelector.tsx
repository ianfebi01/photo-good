import { Button } from '@/components/ui/button'
import { type ClientFrame } from '@/lib/photobooth/frames.client'

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
  onAdd: () => void
} ) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          Choose a frame
        </span>
        <Button size="sm"
          variant="outline"
          onClick={onAdd}
          disabled={disabled}
        >
          + Add frame
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {frames.map( ( f ) => {
          const isActive = f.key === active

          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onSelect( f.key )}
              disabled={disabled && !isActive}
              className={`group flex flex-col items-stretch gap-2 rounded-lg border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isActive
                  ? 'border-primary ring-2 ring-primary/40'
                  : 'border-border hover:border-primary/50'
              }`}
              aria-pressed={isActive}
            >
              <div
                className="overflow-hidden rounded-md bg-muted"
                style={{ aspectRatio : `${f.width} / ${f.height}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.publicUrl}
                  alt={`${f.label} frame preview`}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="truncate text-sm font-medium text-foreground">
                  {f.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {f.photoCount} shots
                </span>
              </div>
              {!f.builtIn && (
                <span className="px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Custom
                </span>
              )}
            </button>
          )
        } )}
      </div>
    </div>
  )
}
