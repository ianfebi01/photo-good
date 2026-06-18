'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Monitor, Power, PowerOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WarningDialog } from '@/components/ui/warning-dialog'
import { AddBoothDialog, BOOTHS_QUERY_KEY } from '@/components/dashboard/AddBoothDialog'

type Booth = {
  id : string
  name : string
  location : string | null
  active : boolean
  created_at : string
  updated_at : string
}

async function fetchBooths() : Promise<Booth[]> {
  const res = await fetch( '/api/admin/booths' )
  if ( !res.ok ) {
    throw new Error( ( await res.json() ).error ?? res.statusText )
  }

  return ( await res.json() ).booths
}

export default function BoothsPage() {
  const [error, setError] = useState( '' )

  const {
    data : booths = [],
    isLoading,
    refetch,
  } = useQuery( {
    queryKey : BOOTHS_QUERY_KEY,
    queryFn  : fetchBooths,
  } )

  async function toggleActive( b : Booth ) {
    try {
      const res = await fetch( `/api/admin/booths/${b.id}`, {
        method  : 'PATCH',
        headers : { 'Content-Type' : 'application/json' },
        body    : JSON.stringify( { active : !b.active } ),
      } )
      const data = await res.json()
      if ( !res.ok ) throw new Error( data.error ?? 'Toggle failed' )
      refetch()
    } catch ( e ) {
      setError( e instanceof Error ? e.message : 'Toggle failed' )
    }
  }

  async function doDelete( id : string ) {
    try {
      const res = await fetch( `/api/admin/booths/${id}`, { method : 'DELETE' } )
      if ( !res.ok ) throw new Error( ( await res.json() ).error ?? 'Delete failed' )
      refetch()
    } catch ( e ) {
      setError( e instanceof Error ? e.message : 'Delete failed' )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Booths</h1>
        <AddBoothDialog onCreated={() => refetch()} />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
          <button
            className="ml-2 underline"
            onClick={() => setError( '' )}
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : booths.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Monitor className="mx-auto size-8 mb-2 opacity-30" />
            <p>No booths yet. Create one above.</p>
          </CardContent>
        </Card>
      ) : (
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
                    onClick={() => toggleActive( b )}
                    title={b.active ? 'Deactivate' : 'Activate'}
                  >
                    {b.active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                  </Button>
                  <WarningDialog
                    title="Delete Booth"
                    description={<>Are you sure you want to delete <span className="font-semibold">{b.name}</span>? This will stop the booth immediately.</>}
                    confirmText="Delete"
                    isDestructive
                    onConfirm={() => doDelete( b.id )}
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ) )}
        </div>
      )}
    </div>
  )
}
