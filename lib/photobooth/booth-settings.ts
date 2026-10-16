import type { BoothClientSettings, BoothDiscountType } from '@/types/booth'

/**
 * The settings shape is defined once, in `types/booth.ts`, because that file is
 * the stand-alone contract the booth client consumes. Re-exported here so
 * server code has a single import site.
 */
export type { BoothClientSettings, BoothDiscountType }

/** Settings applied to new booths and used as fallback for legacy rows. */
export const DEFAULT_BOOTH_SETTINGS : BoothClientSettings = {
  paymentEnabled        : false,
  disabledFrameKeys     : [],
  timerEnabled          : false,
  captureCounterEnabled : false,
  price                 : 15000,
  discountType          : 'percentage',
  discountValue         : 0,
}

/** Every settings key, in display order. */
export const BOOTH_SETTINGS_KEYS = [
  'paymentEnabled',
  'disabledFrameKeys',
  'timerEnabled',
  'captureCounterEnabled',
  'price',
  'discountType',
  'discountValue',
] as const satisfies readonly ( keyof BoothClientSettings )[]

/** The subset of keys that are plain on/off switches. */
export const BOOLEAN_SETTING_KEYS = [
  'paymentEnabled',
  'timerEnabled',
  'captureCounterEnabled',
] as const satisfies readonly ( keyof BoothClientSettings )[]

/** Guard against unbounded growth of the frame deny-list in the JSONB column. */
const MAX_FRAME_KEYS = 500

/** Upper bound for a session price, in IDR. */
export const MAX_BOOTH_PRICE = 100_000_000

export const DISCOUNT_TYPES = ['percentage', 'fixed'] as const satisfies readonly BoothDiscountType[]

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

/** Parse a whole, non-negative amount clamped to `max`, or null when not a number. */
function asAmount( value : unknown, max : number ) : number | null {
  if ( typeof value !== 'number' || !Number.isFinite( value ) ) return null

  return Math.min( Math.max( Math.round( value ), 0 ), max )
}

function asDiscountType( value : unknown ) : BoothDiscountType | null {
  return DISCOUNT_TYPES.includes( value as BoothDiscountType ) ? value as BoothDiscountType : null
}

/** Merge stored (possibly partial or legacy) settings with the defaults. */
export function normalizeBoothSettings( value : unknown ) : BoothClientSettings {
  const raw = ( value && typeof value === 'object' ? value : {} ) as Record<string, unknown>
  const price = asAmount( raw.price, MAX_BOOTH_PRICE ) ?? DEFAULT_BOOTH_SETTINGS.price
  const discountType = asDiscountType( raw.discountType ) ?? DEFAULT_BOOTH_SETTINGS.discountType
  const discountMax = discountType === 'percentage' ? 100 : price

  return {
    paymentEnabled        : asBool( raw.paymentEnabled, DEFAULT_BOOTH_SETTINGS.paymentEnabled ),
    disabledFrameKeys     : asFrameKeys( raw.disabledFrameKeys ),
    timerEnabled          : asBool( raw.timerEnabled, DEFAULT_BOOTH_SETTINGS.timerEnabled ),
    captureCounterEnabled : asBool( raw.captureCounterEnabled, DEFAULT_BOOTH_SETTINGS.captureCounterEnabled ),
    price,
    discountType,
    discountValue         : asAmount( raw.discountValue, discountMax ) ?? DEFAULT_BOOTH_SETTINGS.discountValue,
  }
}

/** The discount in IDR that applies to the booth's price. */
export function getBoothDiscountAmount( settings : BoothClientSettings ) : number {
  const discount = settings.discountType === 'percentage'
    ? Math.round( settings.price * settings.discountValue / 100 )
    : settings.discountValue

  return Math.min( discount, settings.price )
}

/** The amount in IDR a guest pays for one session, after discount. */
export function getBoothPaymentAmount( settings : BoothClientSettings ) : number {
  return settings.price - getBoothDiscountAmount( settings )
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

  // Range checks that depend on other fields (e.g. a fixed discount above the
  // price) are applied by `normalizeBoothSettings` on read.
  const price = asAmount( raw.price, MAX_BOOTH_PRICE )
  if ( price !== null ) picked.price = price

  const discountType = asDiscountType( raw.discountType )
  if ( discountType ) picked.discountType = discountType

  const discountValue = asAmount( raw.discountValue, MAX_BOOTH_PRICE )
  if ( discountValue !== null ) picked.discountValue = discountValue

  return picked
}
