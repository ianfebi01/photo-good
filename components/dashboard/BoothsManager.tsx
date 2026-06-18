'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Monitor, Power, PowerOff, Trash2, Loader2, Radio } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WarningDialog } from '@/components/ui/warning-dialog'
import { DashboardPageHeader } from './DashboardPageHeader'
import { AddBoothDialog } from './AddBoothDialog'
import {
  BOOTHS_QUERY_KEY,
  getBooths,
  deleteBooth,
  type Booth,
} from '@/lib/photobooth/booths.query'

export function BoothsManager() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>( null )

  const boothsQuery = useQuery( {
    queryKey        : BOOTHS_QUERY_KEY,
    queryFn         : getBooths,
    placeholderData : ( prev ) => prev,
  } )

  const toggleMutation = useMutation( {
    mutationFn : async ( { id, active } : { id : string; active : boolean } ) => {
      const res = await fetch( `/api/admin/booths/${id}`, {
        method  : 'PATCH',
        headers : { 'Content-Type' : 'application/json' },
        body    : JSON.stringify( { active } ),
      } )
      const data = await res.json()
      if ( !res.ok ) throw new Error( data.error ?? 'Toggle failed' )
      return data.booth as Booth
    },
    onSuccess : () => {
      queryClient.invalidateQueries( { queryKey : BOOTHS_QUERY_KEY } )
    },
    onError : ( e ) => {
      setError( e instanceof Error ? e.message : 'Toggle failed' )
    },
  } )

  const deleteMutation = useMutation( {
    mutationFn : deleteBooth,
    onSuccess  : () => {
      queryClient.invalidateQueries( { queryKey : BOOTHS_QUERY_KEY } )
    },
    onError : ( e ) => {
      setError( e instanceof Error ? e.message : 'Delete failed' )
    },
  } )

  const handleDelete = ( id : string ) => {
    return new Promise<void>( ( resolve, reject ) => {
      deleteMutation.mutate( id, {
        onSuccess : () => resolve(),
        onError   : ( e ) => reject( e ),
      } )
    } )
  }

  const booths = boothsQuery.data ?? []
  const isLoading = boothsQuery.isLoading
  const activeCount = booths.filter( ( b ) => b.active ).length
  const inactiveCount = booths.length - activeCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <DashboardPageHeader
          title="Booths"
          description="Manage photo booth devices and their API keys."
          action={
            <AddBoothDialog
              onCreated={() => queryClient.invalidateQueries( { queryKey : BOOTHS_QUERY_KEY } )}
            />
          }
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-secondary">
              <Monitor className="size-4 text-neutral-600" />
            </div>
          </div>
          <p className="font-sans text-lg font-bold text-neutral-900">{booths.length}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Total booths</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100">
              <Radio className="size-4 text-emerald-600" />
            </div>
          </div>
          <p className="font-sans text-lg font-bold text-neutral-900">{activeCount}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Active</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-neutral-100">
              <PowerOff className="size-4 text-neutral-600" />
            </div>
          </div>
          <p className="font-sans text-lg font-bold text-neutral-900">{inactiveCount}</p>
          <p className="mt-0.5 text-xs text-neutral-400">Inactive</p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {error}
          <button
            className="ml-2 underline"
            onClick={() => setError( null )}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white p-5">
          <div className="grid gap-4">
            {Array.from( { length : 3 } ).map( ( _, i ) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-neutral-100 p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-4 rounded bg-neutral-200" />
                    <div className="h-4 w-32 rounded bg-neutral-200" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-neutral-200" />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-48 rounded bg-neutral-100" />
                  <div className="h-3 w-36 rounded bg-neutral-100" />
                </div>
              </div>
            ) )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && booths.length === 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white p-5">
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-neutral-100">
              <Monitor className="size-5 text-neutral-400" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">No booths yet</h3>
            <p className="mt-1 max-w-sm text-xs text-neutral-400">
              Create your first booth to get an API key for the photo booth client.
            </p>
            <AddBoothDialog
              onCreated={() => queryClient.invalidateQueries( { queryKey : BOOTHS_QUERY_KEY } )}
              trigger={
                <Button className="mt-4" size="sm">Add first booth</Button>
              }
            />
          </div>
        </div>
      )}

      {/* Booth list */}
      {!isLoading && booths.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white p-5">
          <div className="grid gap-4">
            {booths.map( ( b ) => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Monitor className="size-4" /> {b.name}
                    </CardTitle>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        b.active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {b.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>ID:</strong> <code className="text-xs">{b.id}</code></p>
                    {b.location && <p><strong>Location:</strong> {b.location}</p>}
                    <p><strong>Created:</strong> {new Date( b.created_at ).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleMutation.mutate( { id : b.id, active : !b.active } )}
                      disabled={toggleMutation.isPending}
                      title={b.active ? 'Deactivate' : 'Activate'}
                    >
                      {toggleMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : b.active ? (
                        <PowerOff className="size-3.5" />
                      ) : (
                        <Power className="size-3.5" />
                      )}
                    </Button>
                    <WarningDialog
                      title="Delete Booth"
                      description={<>Are you sure you want to delete <span className="font-semibold">{b.name}</span>? This will stop the booth immediately.</>}
                      confirmText="Delete"
                      isDestructive
                      onConfirm={() => handleDelete( b.id )}
                      trigger={
                        <Button size="sm" variant="outline">
                          <Trash2 className="size-3.5" />
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ) )}
          </div>
        </div>
      )}
    </div>
  )
}
