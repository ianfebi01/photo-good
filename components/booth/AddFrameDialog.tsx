'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import gsap from 'gsap'
import { type ClientFrame } from '@/lib/photobooth/frames.client'
import { cn } from '@/lib/utils'

type FrameSlot = {
  left: number
  top: number
  width: number
  height: number
}

interface AddFrameDialogProps {
  onUploaded: ( frame: ClientFrame ) => void
  trigger?: React.ReactElement
}

export function AddFrameDialog( { onUploaded, trigger }: AddFrameDialogProps ) {
  const [label, setLabel] = useState( '' )
  const [file, setFile] = useState<File | null>( null )
  const [uploading, setUploading] = useState( false )
  const [previewLoading, setPreviewLoading] = useState( false )
  const [err, setErr] = useState<string | null>( null )
  const [copied, setCopied] = useState( false )
  const [dragActive, setDragActive] = useState( false )

  const [detectedSlots, setDetectedSlots] = useState<FrameSlot[]>( [] )
  const [serverPreviewUrl, setServerPreviewUrl] = useState<string | null>( null )

  const fileInputRef = useRef<HTMLInputElement>( null )
  const popupRef = useRef<HTMLDivElement>( null )
  const contentRef = useRef<HTMLDivElement>( null )
  const overlayRef = useRef<HTMLDivElement>( null )
  const actionsRef = useRef<{ unmount: () => void; close: () => void } | null>( null )
  const tlRef = useRef<gsap.core.Timeline | null>( null )
  const isAnimatingRef = useRef( false )

  const previewUrl = useMemo(
    () => ( file ? URL.createObjectURL( file ) : null ),
    [file],
  )

  useEffect( () => {
    return () => {
      if ( previewUrl ) URL.revokeObjectURL( previewUrl )
    }
  }, [previewUrl] )

  // Reset form when dialog opens
  const resetForm = () => {
    setLabel( '' )
    setFile( null )
    setErr( null )
    setDetectedSlots( [] )
    setServerPreviewUrl( null )
  }

  const handleFileChange = async ( selectedFile: File | null ) => {
    setFile( selectedFile )
    setErr( null )
    setServerPreviewUrl( null )
    setDetectedSlots( [] )

    if ( !selectedFile ) return

    setPreviewLoading( true )
    try {
      const formData = new FormData()
      formData.append( 'file', selectedFile )
      const res = await fetch( '/api/frames/preview', {
        method : 'POST',
        body   : formData,
      } )
      const data = await res.json()
      if ( !res.ok ) throw new Error( data.error ?? 'Failed to generate preview' )
      setDetectedSlots( data.slots ?? [] )
      setServerPreviewUrl( data.previewUrl )
    } catch ( e ) {
      setErr( e instanceof Error ? e.message : 'Failed to parse frame' )
    } finally {
      setPreviewLoading( false )
    }
  }

  const handleCopyGreenColor = () => {
    navigator.clipboard.writeText( '#00A651' )
    setCopied( true )
    setTimeout( () => setCopied( false ), 2000 )
  }

  const handleDrag = ( e: React.DragEvent ) => {
    e.preventDefault()
    e.stopPropagation()
    if ( e.type === 'dragenter' || e.type === 'dragover' ) {
      setDragActive( true )
    } else if ( e.type === 'dragleave' ) {
      setDragActive( false )
    }
  }

  const handleDrop = ( e: React.DragEvent ) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive( false )
    if ( e.dataTransfer.files && e.dataTransfer.files[0] ) {
      handleFileChange( e.dataTransfer.files[0] )
    }
  }

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
      resetForm()
      actionsRef.current?.close()
    } catch ( e ) {
      setErr( e instanceof Error ? e.message : 'Upload failed' )
    } finally {
      setUploading( false )
    }
  }

  // Run enter animation whenever popup mounts
  const handlePopupRef = useCallback( ( node: HTMLDivElement | null ) => {
    popupRef.current = node
    if ( !node ) return

    // Kill any running timeline
    tlRef.current?.kill()

    const content = contentRef.current
    const overlay = overlayRef.current

    // Set initial states
    gsap.set( node, {
      scaleY          : 0,
      opacity         : 0,
      transformOrigin : 'center center',
    } )
    if ( overlay ) gsap.set( overlay, { opacity : 0 } )
    if ( content?.children ) {
      gsap.set( content.children, {
        x       : -30,
        opacity : 0,
      } )
    }

    const tl = gsap.timeline()

    // Overlay fade in
    if ( overlay ) {
      tl.to( overlay, {
        opacity  : 1,
        duration : 0.25,
        ease     : 'power2.out',
      }, 0 )
    }

    // Modal scales vertically from center
    tl.to( node, {
      scaleY   : 1,
      opacity  : 1,
      duration : 0.4,
      ease     : 'power3.out',
    }, 0 )

    // Content/fields slide in from left with opacity
    if ( content?.children ) {
      tl.to(
        content.children,
        {
          x        : 0,
          opacity  : 1,
          duration : 0.35,
          stagger  : 0.05,
          ease     : 'power2.out',
        },
        0.15
      )
    }

    tlRef.current = tl
  }, [] )

  const handleOpenChange = useCallback( ( nextOpen: boolean, event: { preventUnmountOnClose: () => void } ) => {
    if ( nextOpen ) {
      resetForm()

      return // Opening is handled by ref callback
    }

    // Guard: don't re-enter if already animating out
    if ( isAnimatingRef.current ) return
    isAnimatingRef.current = true

    // Prevent base-ui from unmounting immediately — we animate out first
    event.preventUnmountOnClose()

    // Kill enter animation if still running
    tlRef.current?.kill()

    const tl = gsap.timeline( {
      onComplete : () => {
        isAnimatingRef.current = false
        actionsRef.current?.unmount()
      },
    } )

    // Reverse: content slides out + fades, then modal scales down
    if ( contentRef.current ) {
      tl.to( contentRef.current.children, {
        x        : -30,
        opacity  : 0,
        duration : 0.25,
        stagger  : 0.03,
        ease     : 'power2.in',
      } )
    }

    if ( popupRef.current ) {
      tl.to(
        popupRef.current,
        {
          scaleY   : 0,
          opacity  : 0,
          duration : 0.3,
          ease     : 'power3.in',
        },
        '-=0.1'
      )
    }

    if ( overlayRef.current ) {
      tl.to(
        overlayRef.current,
        {
          opacity  : 0,
          duration : 0.2,
        },
        '-=0.2'
      )
    }

    tlRef.current = tl
  }, [] )

  return (
    <Dialog
      onOpenChange={handleOpenChange}
      actionsRef={actionsRef}
    >
      <DialogTrigger
        render={
          trigger || (
            <Button
              className="self-start sm:self-center gap-1.5 rounded-xl px-4 py-2 font-sans text-sm font-bold tracking-wide transition-all"
              size="lg"
            >
              <Plus className="size-4" /> Add Frame
            </Button>
          )
        }
      />
      <DialogContent
        ref={handlePopupRef}
        overlayRef={overlayRef}
        className="w-full max-w-full h-dvh max-h-dvh sm:h-auto sm:max-h-[calc(100vh-4rem)] rounded-none sm:rounded-3xl overflow-y-auto sm:max-w-2xl flex flex-col origin-center bg-white p-0 border border-neutral-100 shadow-2xl font-sans"
      >
        <div
          ref={contentRef}
          className="contents font-sans"
        >
          {/* Header */}
          <DialogHeader className="flex flex-row items-center justify-between border-b border-neutral-100 px-6 py-5 shrink-0 font-sans">
            <div className="flex flex-col gap-1 text-left">
              <DialogTitle className="text-xl font-bold text-neutral-900 font-sans">Add a custom frame</DialogTitle>
            </div>
            <DialogClose
              render={
                <button
                  type="button"
                  className="flex items-center justify-center p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer text-neutral-500 hover:text-neutral-950 focus:outline-none"
                >
                  <X className="size-4" />
                </button>
              }
            />
          </DialogHeader>

          {/* Form Fields Body (3-column layout) */}
          <div className="flex flex-col sm:grid sm:grid-cols-[160px_1fr_160px] gap-6 px-6 py-6 font-sans grow min-h-[300px]">
            {/* Column 1: Upload Dragzone Box */}
            <div className="flex flex-col gap-1.5 font-sans h-full">
              <span className="font-semibold text-neutral-500 text-[10px] uppercase tracking-wider">Upload Template</span>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'overflow-hidden flex flex-col items-center justify-center relative h-[260px] sm:h-full font-sans cursor-pointer transition select-none rounded-none',
                  previewUrl
                    ? 'border-none p-0 bg-transparent'
                    : cn(
                      'border border-dashed',
                      dragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-300'
                    )
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={( e ) => handleFileChange( e.target.files?.[0] ?? null )}
                  className="hidden"
                  disabled={uploading}
                />

                {previewUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Selected frame preview"
                      className="h-full w-full object-contain"
                    />
                    {/* Circle X Button in Corner */}
                    <button
                      type="button"
                      onClick={( e ) => {
                        e.stopPropagation()
                        handleFileChange( null )
                      }}
                      className="absolute top-2 right-2 size-6 rounded-full bg-white hover:bg-neutral-100 border border-neutral-200 shadow-md flex items-center justify-center cursor-pointer text-neutral-500 hover:text-neutral-950 transition focus:outline-none z-10"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-neutral-400 font-sans font-medium flex flex-col items-center gap-2 p-4 text-center">
                    <Plus className="size-6 text-neutral-300" />
                    <span>Click or Drag frame</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Inputs & Color Swatch */}
            <div className="flex flex-col gap-5 justify-center font-sans">
              {/* Frame Name Field */}
              <label className="flex flex-col gap-1.5 text-sm font-sans">
                <span className="font-semibold text-neutral-500 text-[10px] uppercase tracking-wider">Frame Name</span>
                <input
                  type="text"
                  value={label}
                  onChange={( e ) => setLabel( e.target.value )}
                  placeholder="e.g. Birthday Strip"
                  maxLength={60}
                  className="rounded-lg border border-neutral-200 bg-background px-3 py-2.5 text-sm font-sans focus:border-primary focus:outline-none transition w-full placeholder:text-neutral-300"
                  disabled={uploading}
                />
              </label>

              {/* Slot Green Color Code */}
              <div className="flex flex-col gap-1.5 font-sans">
                <span className="font-semibold text-neutral-500 text-[10px] uppercase tracking-wider">Slot Green Color Code</span>
                <button
                  type="button"
                  onClick={handleCopyGreenColor}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer text-sm font-mono text-neutral-700 bg-neutral-50/50 w-full group relative"
                >
                  <div className="flex items-center gap-2">
                    <span className="size-4 rounded-full border border-neutral-300"
                      style={{ backgroundColor : '#00A651' }}
                    />
                    <span>#00A651</span>
                  </div>
                  <span className="text-[10px] text-primary font-semibold font-sans opacity-0 group-hover:opacity-100 transition-opacity">
                    {copied ? 'Copied!' : 'Click to copy'}
                  </span>
                </button>
              </div>

              {/* Slots Detected Info */}
              {file && (
                <div className="flex flex-col gap-1 font-sans">
                  <span className="font-semibold text-neutral-500 text-[10px] uppercase tracking-wider">Status</span>
                  <div className="rounded-lg border border-neutral-100 bg-neutral-50/30 px-3 py-2 text-xs font-medium text-neutral-600">
                    {previewLoading ? (
                      <span className="text-neutral-400 flex items-center gap-1.5 animate-pulse">
                        <Loader2 className="size-3 animate-spin" />
                        Detecting slots...
                      </span>
                    ) : detectedSlots.length > 0 ? (
                      <span className="text-emerald-600 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        {detectedSlots.length} slots detected
                      </span>
                    ) : (
                      <span className="text-destructive flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-destructive" />
                        No green slots detected
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Column 3: Preview Slots */}
            <div className="flex flex-col gap-1.5 font-sans h-full">
              <span className="font-semibold text-neutral-500 text-[10px] uppercase tracking-wider">Preview Slots</span>
              <div
                className={cn(
                  'flex-1 overflow-hidden flex items-center justify-center relative min-h-[260px] sm:min-h-[unset] sm:h-full font-sans rounded-none',
                  serverPreviewUrl
                    ? 'border-none p-0 bg-transparent'
                    : 'border border-neutral-100 bg-neutral-50/50'
                )}
              >
                {previewLoading ? (
                  <div className="text-xs text-neutral-400 font-sans font-medium flex flex-col items-center gap-1.5 animate-pulse">
                    <Loader2 className="size-5 text-primary animate-spin" />
                    <span>Processing slots...</span>
                  </div>
                ) : serverPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={serverPreviewUrl}
                    alt="Processed frame preview"
                    className="h-full w-full object-contain drop-shadow-sm"
                  />
                ) : (
                  <div className="text-xs text-neutral-400 font-sans font-medium flex flex-col items-center gap-1.5">
                    <ImageIcon className="size-5 text-neutral-300" />
                    <span>Preview</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {err && (
            <div className="px-6 pb-2">
              <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive font-sans font-medium">
                {err}
              </p>
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="border-t border-neutral-100 px-6 py-4 bg-transparent shrink-0 font-sans flex items-center justify-end gap-2">
            <Button
              onClick={submit}
              disabled={!file || !label.trim() || uploading || detectedSlots.length === 0 || previewLoading}
              className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold text-sm px-4 py-2.5 rounded-lg transition font-sans cursor-pointer"
            >
              {uploading ? 'Uploading…' : 'Upload frame'}
            </Button>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  disabled={uploading}
                  className="border border-neutral-200 hover:bg-neutral-50 text-neutral-800 font-semibold text-sm px-4 py-2.5 rounded-lg transition font-sans cursor-pointer"
                >
                  Cancel
                </Button>
              }
            />
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
