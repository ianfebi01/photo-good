'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Trash2,
  Loader2,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  FRAMES_QUERY_KEY,
  deleteFrame,
  getFrames,
} from '@/lib/photobooth/frames.query'
import { AddFrameDialog } from '@/components/booth/AddFrameDialog'
import { DashboardPageHeader } from './DashboardPageHeader'

const ITEMS_PER_PAGE = 8

export function FramesManager() {
  const queryClient = useQueryClient()
  const [deletingKey, setDeletingKey] = useState<string | null>( null )
  const [page, setPage] = useState( 1 )

  const framesQuery = useQuery( {
    queryKey        : [...FRAMES_QUERY_KEY, { page, limit : ITEMS_PER_PAGE }],
    queryFn         : () => getFrames( { page, limit : ITEMS_PER_PAGE } ),
    placeholderData : ( prev ) => prev,
  } )

  const deleteMutation = useMutation( {
    mutationFn : deleteFrame,
    onMutate   : ( key ) => {
      setDeletingKey( key )
    },
    onSuccess : () => {
      queryClient.invalidateQueries( { queryKey : FRAMES_QUERY_KEY } )
      setPage( 1 )
    },
    onSettled : () => {
      setDeletingKey( null )
    },
  } )

  const allFrames = framesQuery.data?.frames ?? []
  const totalPages = Math.max( 1, Math.ceil( ( framesQuery.data?.total ?? 0 ) / ITEMS_PER_PAGE ) )
  const safePage = Math.min( page, totalPages )

  const handleDelete = ( key: string ) => {
    if (
      !confirm( 'Are you sure you want to delete this custom frame? This cannot be undone.' )
    ) {
      return
    }
    deleteMutation.mutate( key, {
      onError : ( error ) => {
        alert( error instanceof Error ? error.message : 'Error deleting frame' )
      },
    } )
  }
    
  const totalCount = allFrames.length
  const builtInCount = allFrames.filter( ( f ) => f.builtIn ).length
  const customCount = totalCount - builtInCount
  const isLoading = framesQuery.isLoading
  const error = framesQuery.error instanceof Error ? framesQuery.error.message : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <DashboardPageHeader
          title="Frame Templates"
          description="Manage photobooth templates and upload custom frames."
          action={
            <AddFrameDialog
              onUploaded={() => queryClient.invalidateQueries( { queryKey : FRAMES_QUERY_KEY } )}
            />
          }
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
          <p className="font-sans text-lg font-bold text-neutral-900">{totalCount}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Total templates</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-neutral-100">
              <Images className="size-4 text-neutral-600" />
            </div>
          </div>
          <p className="font-sans text-lg font-bold text-neutral-900">{builtInCount}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Built-in</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent/40">
              <Sparkles className="size-4 text-neutral-600" />
            </div>
          </div>
          <p className="font-sans text-lg font-bold text-neutral-900">{customCount}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Custom uploads</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from( { length : ITEMS_PER_PAGE } ).map( ( _, i ) => (
              <div key={i}
                className="flex flex-col justify-between animate-pulse"
              >
                <div>
                  <div className="aspect-3/4 rounded-2xl bg-neutral-200" />
                  <div className="pt-3 flex flex-col gap-2">
                    <div className="h-3 w-2/3 rounded bg-neutral-200" />
                    <div className="flex gap-3">
                      <div className="h-2.5 w-12 rounded bg-neutral-100" />
                      <div className="h-2.5 w-24 rounded bg-neutral-100" />
                    </div>
                  </div>
                </div>
                <div className="pt-3">
                  <div className="h-9 w-full rounded-md bg-neutral-100" />
                </div>
              </div>
            ) )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && allFrames.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-100 bg-white p-16 text-center transition-all duration-300 ease-in-out hover:shadow-xl">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-neutral-100">
              <ImageIcon className="size-5 text-neutral-400" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">No frames available</h3>
            <p className="mt-1 max-w-sm text-xs text-neutral-400">
              Create your first custom frame with green slots where captured photos should go.
            </p>
            <AddFrameDialog
              onUploaded={() => queryClient.invalidateQueries( { queryKey : FRAMES_QUERY_KEY } )}
              trigger={
                <Button className="mt-4"
                  size="sm"
                >
                  Add first frame
                </Button>
              }
            />
          </div>
        )}

        {/* Frames grid */}
        {!isLoading && allFrames.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {allFrames.map( ( frame ) => (
              <div key={frame.key}
                className="flex flex-col justify-between"
              >
                <div>
                  <div className="group relative aspect-3/4 overflow-hidden rounded-2xl bg-neutral-100 p-4 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/frames/preview?key=${frame.key}`}
                      alt={frame.label}
                      className="h-full w-full object-contain drop-shadow transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  <div className="pt-3 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 font-sans text-xs font-semibold text-neutral-900">
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

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={( e ) => {
                  e.preventDefault()
                  setPage( ( p ) => Math.max( 1, p - 1 ) )
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
                  setPage( ( p ) => Math.min( totalPages, p + 1 ) )
                }}
                className={safePage >= totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
