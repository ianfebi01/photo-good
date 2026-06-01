import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { type ClientFrame } from '@/lib/photobooth/frames.client'

export function FrameUploadForm( {
  onCancel,
  onUploaded,
}: {
  onCancel: () => void
  onUploaded: ( frame: ClientFrame ) => void
} ) {
  const [label, setLabel] = useState( '' )
  const [file, setFile] = useState<File | null>( null )
  const [uploading, setUploading] = useState( false )
  const [err, setErr] = useState<string | null>( null )

  const previewUrl = useMemo(
    () => ( file ? URL.createObjectURL( file ) : null ),
    [file],
  )

  useEffect( () => {
    return () => {
      if ( previewUrl ) URL.revokeObjectURL( previewUrl )
    }
  }, [previewUrl] )

  const submit = async () => {
    if ( !file || !label.trim() ) return
    setUploading( true )
    setErr( null )
    try {
      const form = new FormData()
      form.append( 'file', file )
      form.append( 'label', label.trim() )
      const res = await fetch( '/api/frames', { method : 'POST', body : form } )
      const data = await res.json()
      if ( !res.ok ) throw new Error( data.error ?? 'Upload failed' )
      onUploaded( data.frame as ClientFrame )
    } catch ( e ) {
      setErr( e instanceof Error ? e.message : 'Upload failed' )
    } finally {
      setUploading( false )
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Add a custom frame
            </h2>
            <p className="text-xs text-muted-foreground">
              Upload a PNG/JPEG/WEBP (≤ 8 MB) with each photo slot painted solid
              green. Slots are detected automatically.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={uploading}
          >
            Cancel
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Name</span>
              <input
                type="text"
                value={label}
                onChange={( e ) => setLabel( e.target.value )}
                placeholder="e.g. Birthday Strip"
                maxLength={60}
                className="rounded-md border bg-background px-3 py-2 text-sm"
                disabled={uploading}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Image</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={( e ) => setFile( e.target.files?.[0] ?? null )}
                className="text-sm"
                disabled={uploading}
              />
            </label>
            {err && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {err}
              </p>
            )}
            <div>
              <Button
                onClick={submit}
                disabled={!file || !label.trim() || uploading}
              >
                {uploading ? 'Uploading…' : 'Upload frame'}
              </Button>
            </div>
          </div>

          <div
            className="overflow-hidden rounded-md border bg-muted"
            style={{ minHeight : 140 }}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Selected frame preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="grid h-full place-items-center p-2 text-center text-xs text-muted-foreground">
                Preview
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
