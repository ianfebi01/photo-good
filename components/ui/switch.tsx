'use client'

import { cn } from '@/lib/utils'

type SwitchProps = {
  checked : boolean
  disabled? : boolean
  onChange : ( next : boolean ) => void
  /** Accessible name, used when the switch has no visible label element. */
  label? : string
  /** Id of an element that labels the switch. */
  labelId? : string
  className? : string
}

/** Minimal accessible on/off switch used across dashboard settings. */
export function Switch( {
  checked,
  disabled,
  onChange,
  label,
  labelId,
  className,
}: SwitchProps ) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelId}
      disabled={disabled}
      onClick={() => onChange( !checked )}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
        'disabled:cursor-default disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-neutral-200',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5.5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
