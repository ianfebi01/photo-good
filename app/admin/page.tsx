'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { type ClientFrame } from '@/lib/photobooth/frames.client'
import { AddFrameDialog } from '@/components/booth/AddFrameDialog'

export default function AdminPage() {
  const [frames, setFrames] = useState<ClientFrame[]>( [] )
  const [loading, setLoading] = useState( true )
  const [error, setError] = useState<string | null>( null )
  const [deletingKey, setDeletingKey] = useState<string | null>( null )

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

  // Calculate stats
  const totalCount = frames.length
  const builtInCount = frames.filter( ( f ) => f.builtIn ).length
  const customCount = totalCount - builtInCount

  return (
    <main className="min-h-screen bg-neutral-50/50 py-12 font-sans">
      <div className="container max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/booth"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-sans"
              >
                <ArrowLeft className="size-3" /> Back to Photobooth
              </Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">
              Admin Panel
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-sans">
              Manage photobooth templates, upload custom green-slot frames, and
              configure assets.
            </p>
          </div>

          <AddFrameDialog
            onUploaded={( newFrame ) => setFrames( ( prev ) => [...prev, newFrame] )}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card
            size="sm"
            className="bg-white shadow-sm ring-1 ring-neutral-200"
          >
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider font-sans">
                Total Templates
              </div>
              <div className="text-3xl font-bold mt-1 text-foreground font-sans">
                {totalCount}
              </div>
            </CardContent>
          </Card>
          <Card
            size="sm"
            className="bg-white shadow-sm ring-1 ring-neutral-200"
          >
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider font-sans">
                Built-In
              </div>
              <div className="text-3xl font-bold mt-1 text-neutral-500 font-sans">
                {builtInCount}
              </div>
            </CardContent>
          </Card>
          <Card
            size="sm"
            className="bg-white shadow-sm ring-1 ring-neutral-200"
          >
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider font-sans">
                Custom Uploads
              </div>
              <div className="text-3xl font-bold mt-1 text-primary font-sans">
                {customCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 font-sans">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-medium font-sans">
              Fetching templates...
            </p>
          </div>
        ) : frames.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-3xl p-16 text-center bg-white shadow-sm">
            <div className="size-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-4">
              <ImageIcon className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground font-sans">
              No frames available
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm font-sans">
              Create your first custom frame with green slots where captured
              photos should go.
            </p>
            <AddFrameDialog
              onUploaded={( newFrame ) => setFrames( ( prev ) => [...prev, newFrame] )}
              trigger={
                <Button
                  className="mt-4 font-sans"
                  size="sm"
                >
                  Add first frame
                </Button>
              }
            />
          </div>
        ) : (
          /* Grid of Frames */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {frames.map( ( frame ) => (
              <Card
                key={frame.key}
                className="bg-white shadow-sm hover:shadow-md ring-1 ring-neutral-200 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Aspect Ratio Controlled Preview */}
                  <div className="aspect-3/4 bg-transparent p-4 border-b flex items-center justify-center relative overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/frames/preview?key=${frame.key}`}
                      alt={frame.label}
                      className="h-full w-full object-contain drop-shadow transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  <CardContent className="pt-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground text-sm line-clamp-1 font-sans">
                        {frame.label}
                      </h3>
                      {frame.builtIn ? (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 uppercase tracking-wider font-sans">
                          Built-in
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider font-sans">
                          Custom
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1 font-sans">
                      <span>{frame.photoCount} slots</span>
                      <span className="text-neutral-300">•</span>
                      <span>
                        {frame.width} × {frame.height} px
                      </span>
                    </div>
                  </CardContent>
                </div>

                {!frame.builtIn && (
                  <div className="px-4 pb-4 pt-1 flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete( frame.key )}
                      disabled={deletingKey === frame.key}
                      className="w-full gap-1 font-sans"
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
              </Card>
            ) )}
          </div>
        )}
      </div>
    </main>
  )
}
