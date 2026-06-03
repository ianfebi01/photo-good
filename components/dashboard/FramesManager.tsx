'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { type ClientFrame } from '@/lib/photobooth/frames.client'
import { AddFrameDialog } from '@/components/booth/AddFrameDialog'

export function FramesManager() {
  const [frames, setFrames] = useState<ClientFrame[]>( [] )
  const [loading, setLoading] = useState( true )
  const [error, setError] = useState<string | null>( null )
  const [deletingKey, setDeletingKey] = useState<string | null>( null )
  const [cacheBuster, setCacheBuster] = useState( '' )

  useEffect( () => {
    const timer = setTimeout( () => {
      setCacheBuster( String( Date.now() ) )
    }, 0 )

    return () => clearTimeout( timer )
  }, [] )

  useEffect( () => {
    let active = true

    const loadFrames = async () => {
      try {
        const res = await fetch( '/api/frames' )
        const data = await res.json()
        if ( !active ) return
        if ( !res.ok ) throw new Error( data.error ?? 'Failed to load frames' )
        if ( Array.isArray( data.frames ) ) {
          setFrames( data.frames )
        } else {
          throw new Error( 'Invalid format returned from server' )
        }
      } catch ( e ) {
        if ( !active ) return
        setError( e instanceof Error ? e.message : 'Failed to fetch frames' )
      } finally {
        if ( active ) setLoading( false )
      }
    }

    loadFrames()

    return () => {
      active = false
    }
  }, [] )

  const handleDelete = async ( key: string ) => {
    if (
      !confirm(
        'Are you sure you want to delete this custom frame? This cannot be undone.',
      )
    ) {
      return
    }

    setDeletingKey( key )
    try {
      const res = await fetch( `/api/frames?key=${encodeURIComponent( key )}`, {
        method : 'DELETE',
      } )
      const data = await res.json()
      if ( !res.ok ) throw new Error( data.error ?? 'Failed to delete frame' )
      setFrames( ( prev ) => prev.filter( ( f ) => f.key !== key ) )
    } catch ( e ) {
      alert( e instanceof Error ? e.message : 'Error deleting frame' )
    } finally {
      setDeletingKey( null )
    }
  }

  const totalCount = frames.length
  const builtInCount = frames.filter( ( f ) => f.builtIn ).length
  const customCount = totalCount - builtInCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/booth"
            className="inline-flex items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="size-3" />
            Back to Photobooth
          </Link>
          <h1 className="mt-2 text-xl font-bold text-neutral-900">Frame Templates</h1>
          <p className="mt-0.5 text-xs text-neutral-400">
            Manage photobooth templates and upload custom frames.
          </p>
        </div>
        <AddFrameDialog
          onUploaded={( newFrame ) => setFrames( ( prev ) => [...prev, newFrame] )}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-secondary">
              <LayoutGrid className="size-4 text-neutral-600" />
            </div>
          </div>
          <p className="text-lg font-bold text-neutral-900">{totalCount}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Total templates</p>
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-neutral-100">
              <Images className="size-4 text-neutral-600" />
            </div>
          </div>
          <p className="text-lg font-bold text-neutral-900">{builtInCount}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Built-in</p>
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent/40">
              <Sparkles className="size-4 text-neutral-600" />
            </div>
          </div>
          <p className="text-lg font-bold text-neutral-900">{customCount}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Custom uploads</p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="size-7 animate-spin text-neutral-400" />
          <p className="text-xs text-neutral-400">Fetching templates…</p>
        </div>
      ) : frames.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-100 bg-white p-16 text-center transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-neutral-100">
            <ImageIcon className="size-5 text-neutral-400" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-900">No frames available</h3>
          <p className="mt-1 max-w-sm text-xs text-neutral-400">
            Create your first custom frame with green slots where captured photos should go.
          </p>
          <AddFrameDialog
            onUploaded={( newFrame ) => setFrames( ( prev ) => [...prev, newFrame] )}
            trigger={
              <Button
                className="mt-4"
                size="sm"
              >
                Add first frame
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {frames.map( ( frame ) => (
            <div
              key={frame.key}
              className="flex flex-col justify-between"
            >
              <div>
                <div className="group relative aspect-3/4 overflow-hidden rounded-2xl bg-neutral-100 p-4 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/frames/preview?key=${frame.key}${cacheBuster ? `&t=${cacheBuster}` : ''}`}
                    alt={frame.label}
                    className="h-full w-full object-contain drop-shadow transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <div className="pt-3 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-sm font-semibold text-neutral-900">
                      {frame.label}
                    </h3>
                    {frame.builtIn ? (
                      <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Built-in
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Custom
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-400">
                    <span>{frame.photoCount} slots</span>
                    <span className="text-neutral-200">•</span>
                    <span>{frame.width} × {frame.height} px</span>
                  </div>
                </div>
              </div>

              {!frame.builtIn && (
                <div className="pt-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete( frame.key )}
                    disabled={deletingKey === frame.key}
                    className="w-full gap-1"
                  >
                    {deletingKey === frame.key ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ) )}
        </div>
      )}
    </div>
  )
}
