'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CreditCard,
  Hash,
  Loader2,
  RotateCcw,
  Timer,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import { DashboardPageHeader } from './DashboardPageHeader'
import {
  BOOTHS_QUERY_KEY,
  BOOTH_QUERY_KEY,
  getBooth,
  updateBooth,
  type BoothPatch,
} from '@/lib/photobooth/booths.query'
import {
  FRAMES_PAGE_SIZE,
  FRAMES_QUERY_KEY,
  getFrames,
} from '@/lib/photobooth/frames.query'
import {
  isFrameEnabledForBooth,
  normalizeBoothSettings,
  type BoothClientSettings,
} from '@/lib/photobooth/booth-settings'

/** Keys rendered as simple on/off switches (everything except the frame list). */
type ToggleSettingKey = Exclude<keyof BoothClientSettings, 'disabledFrameKeys'>

/** Toggles exposed to the booth client, in display order. */
const SETTING_FIELDS : {
  key : ToggleSettingKey
  label : string
  description : string
  icon : typeof CreditCard
}[] = [
  {
    key         : 'paymentEnabled',
    label       : 'Payment',
    description : 'Collect QRIS payment before a session starts.',
    icon        : CreditCard,
  },
  {
    key         : 'timerEnabled',
    label       : 'Timer',
    description : 'Show the countdown before each capture.',
    icon        : Timer,
  },
  {
    key         : 'captureCounterEnabled',
    label       : 'Capture counter',
    description : 'Show the “photo X of Y” progress counter.',
    icon        : Hash,
  },
]

function ToggleRow( {
  id,
  label,
  description,
  icon : Icon,
  checked,
  disabled,
  onChange,
} : {
  id : string
  label : string
  description : string
  icon : typeof CreditCard
  checked : boolean
  disabled : boolean
  onChange : ( next : boolean ) => void
} ) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-100 bg-white p-3.5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon className="size-4 text-neutral-600" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span
            id={`${id}-label`}
            className="font-sans text-sm font-semibold text-neutral-900"
          >
            {label}
          </span>
          <span className="font-jakarta text-xs text-neutral-400">{description}</span>
        </div>
      </div>

      <Switch
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        labelId={`${id}-label`}
      />
    </div>
  )
}

export function BoothSettingsPanel( { boothId } : { boothId : string } ) {
  const queryClient = useQueryClient()
  const [patch, setPatch] = useState<Partial<BoothClientSettings>>( {} )
  const [nameInput, setNameInput] = useState<string | null>( null )
  const [page, setPage] = useState( 1 )
  const [error, setError] = useState<string | null>( null )
  const [saved, setSaved] = useState( false )

  const boothQuery = useQuery( {
    queryKey : [...BOOTH_QUERY_KEY, boothId],
    queryFn  : () => getBooth( boothId ),
  } )

  const framesQuery = useQuery( {
    queryKey        : [...FRAMES_QUERY_KEY, { page, limit : FRAMES_PAGE_SIZE }],
    queryFn         : () => getFrames( { page, limit : FRAMES_PAGE_SIZE } ),
    placeholderData : ( prev ) => prev,
  } )

  const booth = boothQuery.data

  // Un-saved edits layered over the persisted settings. `nameInput === null`
  // means "not edited yet", so it mirrors whatever the server returned.
  const settings = useMemo(
    () => normalizeBoothSettings( { ...( booth?.settings ?? {} ), ...patch } ),
    [booth?.settings, patch],
  )

  const name = nameInput ?? booth?.name ?? ''
  const trimmedName = name.trim()
  const nameChanged = nameInput !== null && trimmedName !== ( booth?.name ?? '' )
  const nameValid = trimmedName.length >= 2

  const frames = framesQuery.data?.frames ?? []
  const total = framesQuery.data?.total ?? 0
  const totalPages = Math.max( 1, Math.ceil( total / FRAMES_PAGE_SIZE ) )
  const safePage = Math.min( page, totalPages )
  const dirty = Object.keys( patch ).length > 0 || nameChanged
  const disabledCount = settings.disabledFrameKeys.length

  const saveMutation = useMutation( {
    mutationFn : ( payload : BoothPatch ) => updateBooth( boothId, payload ),
    onSuccess  : ( updated ) => {
      queryClient.setQueryData( [...BOOTH_QUERY_KEY, boothId], updated )
      queryClient.invalidateQueries( { queryKey : BOOTHS_QUERY_KEY } )
      setPatch( {} )
      setNameInput( null )
      setError( null )
      setSaved( true )
    },
    onError : ( e ) => {
      setSaved( false )
      setError( e instanceof Error ? e.message : 'Failed to save settings' )
    },
  } )

  const saving = saveMutation.isPending

  const setFlag = ( key : ToggleSettingKey, value : boolean ) => {
    setSaved( false )
    setPatch( ( prev ) => ( { ...prev, [key] : value } ) )
  }

  const toggleFrame = ( frameKey : string ) => {
    setSaved( false )
    setPatch( ( prev ) => {
      const current = prev.disabledFrameKeys ?? booth?.settings.disabledFrameKeys ?? []
      const next = current.includes( frameKey )
        ? current.filter( ( key ) => key !== frameKey )
        : [ ...current, frameKey ]

      return { ...prev, disabledFrameKeys : next }
    } )
  }

  const enableAllFrames = () => {
    setSaved( false )
    setPatch( ( prev ) => ( { ...prev, disabledFrameKeys : [] } ) )
  }

  const resetDraft = () => {
    setPatch( {} )
    setNameInput( null )
    setSaved( false )
    setError( null )
  }

  const handleSave = () => {
    const payload : BoothPatch = {}
    if ( Object.keys( patch ).length > 0 ) payload.settings = patch
    if ( nameChanged ) payload.name = trimmedName

    saveMutation.mutate( payload )
  }

  if ( !booth ) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/booths"
          className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-neutral-400 transition hover:text-neutral-700"
        >
          <ArrowLeft className="size-3.5" /> All booths
        </Link>

        <div className="rounded-2xl border border-neutral-100 bg-white p-10 text-center font-jakarta text-sm text-neutral-400">
          {boothQuery.isError ? 'Could not load this booth.' : 'Loading booth…'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/booths"
        className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-neutral-400 transition hover:text-neutral-700"
      >
        <ArrowLeft className="size-3.5" /> All booths
      </Link>

      <DashboardPageHeader
        label="Booth settings"
        title={(
          <span className="flex items-center gap-2">
            {name || 'Untitled booth'}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                booth.active
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-neutral-100 text-neutral-500',
              )}
            >
              {booth.active ? 'Active' : 'Inactive'}
            </span>
          </span>
        )}
        description={booth.location
          ? `${booth.location} · applied the next time the booth client starts.`
          : 'Applied the next time the booth client starts.'}
        action={(
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="font-sans text-xs font-medium text-amber-600">
                Unsaved changes
              </span>
            )}
            {saved && !dirty && (
              <span className="font-sans text-xs font-medium text-emerald-600">
                Saved
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl font-sans"
              disabled={!dirty || saving}
              onClick={resetDraft}
            >
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <Button
              size="sm"
              className="gap-1.5 rounded-xl font-sans font-bold"
              disabled={!dirty || saving || !nameValid}
              onClick={handleSave}
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save changes
            </Button>
          </div>
        )}
      />

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 font-sans text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      {/* Booth details */}
      <section className="rounded-2xl border border-neutral-100 bg-white p-5">
        <h2 className="font-sans text-sm font-bold text-neutral-900">Booth details</h2>
        <p className="mt-0.5 font-jakarta text-xs text-neutral-400">
          Shown across the dashboard and on this booth result page.
        </p>

        <label className="mt-4 flex flex-col gap-1.5 sm:max-w-sm">
          <span className="font-sans text-[10px] font-semibold tracking-wider text-neutral-500">
            Booth name
          </span>
          <input
            type="text"
            value={name}
            onChange={( e ) => {
              setSaved( false )
              setNameInput( e.target.value )
            }}
            placeholder="e.g. Photo Booth 1"
            maxLength={60}
            disabled={saving}
            className="w-full rounded-lg border border-neutral-200 bg-background px-3 py-2.5 font-sans text-sm transition placeholder:text-neutral-300 focus:border-primary focus:outline-none"
          />
          {!nameValid && (
            <span className="font-jakarta text-xs font-medium text-destructive">
              Name must be at least 2 characters.
            </span>
          )}
        </label>
      </section>

      {/* Client experience */}
      <section className="rounded-2xl border border-neutral-100 bg-white p-5">
        <h2 className="font-sans text-sm font-bold text-neutral-900">Client experience</h2>
        <p className="mt-0.5 font-jakarta text-xs text-neutral-400">
          Choose which steps the booth client shows to guests.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SETTING_FIELDS.map( ( field ) => (
            <ToggleRow
              key={field.key}
              id={`${booth.id}-${field.key}`}
              label={field.label}
              description={field.description}
              icon={field.icon}
              checked={settings[field.key]}
              disabled={saving}
              onChange={( next ) => setFlag( field.key, next )}
            />
          ) )}
        </div>
      </section>

      {/* Frame availability */}
      <section className="rounded-2xl border border-neutral-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-sans text-sm font-bold text-neutral-900">Frame availability</h2>
            <p className="mt-0.5 font-jakarta text-xs text-neutral-400">
              {disabledCount === 0
                ? 'Every frame is available to this booth, including new uploads.'
                : `${disabledCount} frame${disabledCount === 1 ? '' : 's'} disabled for this booth.`}
            </p>
            {total > 0 && disabledCount >= total && (
              <p className="mt-1 font-jakarta text-xs font-medium text-destructive">
                No frames are available to this booth — guests will not be able to capture.
              </p>
            )}
          </div>

          {disabledCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-sans"
              disabled={saving}
              onClick={enableAllFrames}
            >
              Enable all frames
            </Button>
          )}
        </div>

        {framesQuery.isLoading && frames.length === 0 && (
          <p className="mt-4 flex items-center gap-2 font-jakarta text-xs text-neutral-400">
            <Loader2 className="size-3.5 animate-spin" /> Loading frames…
          </p>
        )}

        {framesQuery.isError && (
          <p className="mt-4 font-sans text-xs font-medium text-destructive">
            Could not load frames. Other settings can still be saved.
          </p>
        )}

        {!framesQuery.isLoading && !framesQuery.isError && frames.length === 0 && (
          <p className="mt-4 font-jakarta text-xs text-neutral-400">
            No frames yet — upload one from the Frames page.
          </p>
        )}

        {frames.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {frames.map( ( frame ) => {
              const enabled = isFrameEnabledForBooth( settings, frame.key )

              return (
                <div
                  key={frame.key}
                  className="flex flex-col gap-2"
                >
                  <div
                    className={cn(
                      'group relative flex aspect-3/4 items-center justify-center overflow-hidden rounded-2xl bg-neutral-100 p-3 transition',
                      !enabled && 'opacity-60',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/frames/preview?key=${encodeURIComponent( frame.key )}`}
                      alt={frame.label}
                      className={cn(
                        'h-full w-full object-contain drop-shadow transition-transform duration-300',
                        enabled && 'group-hover:scale-105',
                      )}
                    />
                    {!enabled && (
                      <span className="absolute inset-x-3 bottom-3 rounded-lg bg-neutral-900/80 px-2 py-1 text-center font-sans text-[10px] font-bold uppercase tracking-wider text-white">
                        Disabled
                      </span>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-sans text-xs font-semibold text-neutral-900">
                        {frame.label}
                      </p>
                      <p className="font-jakarta text-[10px] text-neutral-400">
                        {frame.photoCount} slots{frame.builtIn ? ' · built-in' : ''}
                      </p>
                    </div>
                    <Switch
                      checked={enabled}
                      disabled={saving}
                      onChange={() => toggleFrame( frame.key )}
                      label={`${enabled ? 'Disable' : 'Enable'} ${frame.label} for ${booth.name}`}
                    />
                  </div>
                </div>
              )
            } )}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination className="mt-6">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={( e ) => {
                    e.preventDefault()
                    setPage( safePage - 1 )
                  }}
                  className={safePage <= 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {Array.from( { length : totalPages }, ( _, i ) => i + 1 ).map( ( p ) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === safePage}
                    onClick={( e ) => {
                      e.preventDefault()
                      setPage( p )
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ) )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={( e ) => {
                    e.preventDefault()
                    setPage( safePage + 1 )
                  }}
                  className={safePage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </section>
    </div>
  )
}
