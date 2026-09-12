import type { BoothClientSettings } from '@/types/booth'

/**
 * The settings shape is defined once, in `types/booth.ts`, because that file is
 * the stand-alone contract the booth client consumes. Re-exported here so
 * server code has a single import site.
 */
export type { BoothClientSettings }

/** Settings applied to new booths and used as fallback for legacy rows. */
export const DEFAULT_BOOTH_SETTINGS : BoothClientSettings = {
  paymentEnabled        : false,
  disabledFrameKeys     : [],
  timerEnabled          : false,
  captureCounterEnabled : false,
}

/** Every settings key, in display order. */
export const BOOTH_SETTINGS_KEYS = [
  'paymentEnabled',
  'disabledFrameKeys',
  'timerEnabled',
  'captureCounterEnabled',
] as const satisfies readonly ( keyof BoothClientSettings )[]

/** The subset of keys that are plain on/off switches. */
export const BOOLEAN_SETTING_KEYS = [
  'paymentEnabled',
  'timerEnabled',
  'captureCounterEnabled',
] as const satisfies readonly ( keyof BoothClientSettings )[]

/** Guard against unbounded growth of the frame deny-list in the JSONB column. */
const MAX_FRAME_KEYS = 500

function asBool( value : unknown, fallback : boolean ) : boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Parse a list of frame keys — anything malformed becomes an empty list. */
function asFrameKeys( value : unknown ) : string[] {
  if ( !Array.isArray( value ) ) return []

  const keys = value
    .filter( ( key ) : key is string => typeof key === 'string' && key.length > 0 )
    .slice( 0, MAX_FRAME_KEYS )

  return Array.from( new Set( keys ) )
}

/** Merge stored (possibly partial or legacy) settings with the defaults. */
export function normalizeBoothSettings( value : unknown ) : BoothClientSettings {
  const raw = ( value && typeof value === 'object' ? value : {} ) as Record<string, unknown>

  return {
    paymentEnabled        : asBool( raw.paymentEnabled, DEFAULT_BOOTH_SETTINGS.paymentEnabled ),
    disabledFrameKeys     : asFrameKeys( raw.disabledFrameKeys ),
    timerEnabled          : asBool( raw.timerEnabled, DEFAULT_BOOTH_SETTINGS.timerEnabled ),
    captureCounterEnabled : asBool( raw.captureCounterEnabled, DEFAULT_BOOTH_SETTINGS.captureCounterEnabled ),
  }
}

/** Whether a frame may be used by a booth. */
export function isFrameEnabledForBooth( settings : BoothClientSettings, frameKey : string ) : boolean {
  return !settings.disabledFrameKeys.includes( frameKey )
}

/**
 * Pick only known settings from an untrusted patch, so a client can never
 * inject arbitrary keys into the JSONB column.
 */
export function pickBoothSettings( value : unknown ) : Partial<BoothClientSettings> {
  const raw = ( value && typeof value === 'object' ? value : {} ) as Record<string, unknown>
  const picked : Partial<BoothClientSettings> = {}

  for ( const key of BOOLEAN_SETTING_KEYS ) {
    if ( typeof raw[key] === 'boolean' ) picked[key] = raw[key]
  }

  if ( Array.isArray( raw.disabledFrameKeys ) ) {
    picked.disabledFrameKeys = asFrameKeys( raw.disabledFrameKeys )
  }

  return picked
}
