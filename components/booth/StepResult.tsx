import { Button } from '@/components/ui/button'
import { useBoothStore } from '@/store/boothStore'

export function StepResult() {
  const { strip, frameKey, reset } = useBoothStore()

  if ( !strip ) return null

  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-lg font-semibold text-foreground">
        Your strip is ready
      </h2>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={strip}
        alt="Composed photo strip"
        className="max-h-[70vh] w-auto rounded-lg border shadow-sm"
      />

      <div className="flex gap-3">
        <a href={strip}
          download={`photobooth-${frameKey}.jpg`}
        >
          <Button size="lg">Download strip</Button>
        </a>
        <Button size="lg"
          variant="outline"
          onClick={reset}
        >
          New session
        </Button>
      </div>
    </div>
  )
}
