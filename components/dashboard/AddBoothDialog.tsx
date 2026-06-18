'use client'

import { useState, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Plus, X, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import gsap from 'gsap'

type Booth = {
  id : string
  name : string
  location : string | null
  active : boolean
  created_at : string
  updated_at : string
}

export const BOOTHS_QUERY_KEY = ['admin', 'booths'] as const

interface AddBoothDialogProps {
  onCreated? : ( booth : Booth ) => void
  trigger? : React.ReactElement
}

export function AddBoothDialog( { onCreated, trigger } : AddBoothDialogProps ) {
  const [name, setName] = useState( '' )
  const [location, setLocation] = useState( '' )
  const [newApiKey, setNewApiKey] = useState<string | null>( null )
  const [err, setErr] = useState<string | null>( null )

  const popupRef = useRef<HTMLDivElement>( null )
  const contentRef = useRef<HTMLDivElement>( null )
  const overlayRef = useRef<HTMLDivElement>( null )
  const actionsRef = useRef<{ unmount : () => void; close : () => void } | null>( null )
  const tlRef = useRef<gsap.core.Timeline | null>( null )
  const isAnimatingRef = useRef( false )

  const queryClient = useQueryClient()

  const resetForm = () => {
    setName( '' )
    setLocation( '' )
    setNewApiKey( null )
    setErr( null )
  }

  const createMutation = useMutation( {
    mutationFn : async () => {
      const res = await fetch( '/api/admin/booths', {
        method  : 'POST',
        headers : { 'Content-Type' : 'application/json' },
        body    : JSON.stringify( {
          name     : name.trim(),
          location : location.trim() || undefined,
        } ),
      } )
      const data = await res.json()
      if ( !res.ok ) throw new Error( data.error ?? 'Create failed' )
      
      return data.booth as Booth & { api_key : string }
    },
    onSuccess : ( booth ) => {
      queryClient.invalidateQueries( { queryKey : BOOTHS_QUERY_KEY } )
      setNewApiKey( booth.api_key )
      onCreated?.( booth )
    },
    onError : ( error ) => {
      setErr( error instanceof Error ? error.message : 'Create failed' )
    },
  } )

  const creating = createMutation.isPending

  // Run enter animation whenever popup mounts
  const handlePopupRef = useCallback( ( node : HTMLDivElement | null ) => {
    popupRef.current = node
    if ( !node ) return

    tlRef.current?.kill()

    const content = contentRef.current
    const overlay = overlayRef.current

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

    if ( overlay ) {
      tl.to( overlay, {
        opacity  : 1,
        duration : 0.25,
        ease     : 'power2.out',
      }, 0 )
    }

    tl.to( node, {
      scaleY   : 1,
      opacity  : 1,
      duration : 0.4,
      ease     : 'power3.out',
    }, 0 )

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

  const handleOpenChange = useCallback( ( nextOpen : boolean, event : { preventUnmountOnClose : () => void } ) => {
    if ( nextOpen ) {
      resetForm()
      
      return
    }

    if ( isAnimatingRef.current ) return
    isAnimatingRef.current = true

    event.preventUnmountOnClose()

    tlRef.current?.kill()

    const tl = gsap.timeline( {
      onComplete : () => {
        isAnimatingRef.current = false
        actionsRef.current?.unmount()
      },
    } )

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

  const submit = () => {
    if ( !name.trim() ) return
    setErr( null )
    createMutation.mutate()
  }

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
              size="sm"
            >
              <Plus className="size-4" /> New Booth
            </Button>
          )
        }
      />
      <DialogContent
        ref={handlePopupRef}
        overlayRef={overlayRef}
        className="w-full max-w-full h-dvh max-h-dvh sm:h-auto sm:max-h-[calc(100vh-4rem)] rounded-none sm:rounded-3xl overflow-y-auto sm:max-w-lg flex flex-col origin-center bg-white p-0 border border-neutral-100 shadow-2xl"
      >
        <div
          ref={contentRef}
          className="contents"
        >
          {/* Header */}
          <DialogHeader className="flex flex-row items-center justify-between border-b border-neutral-100 px-6 py-5 shrink-0 font-sans">
            <div className="flex flex-col gap-1 text-left">
              <DialogTitle className="text-xl font-bold text-neutral-900 font-sans">Add a new booth</DialogTitle>
              <DialogDescription className="text-sm text-neutral-500 font-jakarta">API key is shown once after creation.</DialogDescription>
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

          {/* Body */}
          <div className="flex flex-col gap-5 px-6 py-6 font-jakarta">
            {/* Booth Name */}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-neutral-500 text-[10px] tracking-wider">Booth Name</span>
              <input
                type="text"
                value={name}
                onChange={( e ) => setName( e.target.value )}
                placeholder="e.g. Photo Booth 1"
                maxLength={60}
                className="rounded-lg border border-neutral-200 bg-background px-3 py-2.5 text-sm font-sans focus:border-primary focus:outline-none transition w-full placeholder:text-neutral-300"
                disabled={creating}
              />
            </label>

            {/* Location */}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-neutral-500 text-[10px] tracking-wider">
                Location <span className="font-normal text-neutral-400">(optional)</span>
              </span>
              <input
                type="text"
                value={location}
                onChange={( e ) => setLocation( e.target.value )}
                placeholder="e.g. Main Hall"
                maxLength={60}
                className="rounded-lg border border-neutral-200 bg-background px-3 py-2.5 text-sm font-sans focus:border-primary focus:outline-none transition w-full placeholder:text-neutral-300"
                disabled={creating}
              />
            </label>

            {/* API Key reveal */}
            {newApiKey && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-xs font-semibold text-emerald-700 mb-1.5">API Key — copy now!</p>
                <code className="text-xs break-all select-all text-emerald-800 font-mono">{newApiKey}</code>
              </div>
            )}
          </div>

          {err && (
            <div className="px-6 pb-2">
              <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive font-sans font-medium">
                {err}
              </p>
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="border-t border-neutral-100 px-6 py-4 shrink-0">
            <DialogClose
              render={
                <Button
                  variant="outline"
                  className="rounded-xl font-sans text-sm font-medium"
                  disabled={creating}
                >
                  Cancel
                </Button>
              }
            />
            <Button
              disabled={creating || !name.trim()}
              onClick={() => ( newApiKey ? actionsRef.current?.close() : submit() )}
              className="rounded-xl font-sans text-sm font-bold"
            >
              {creating && <Loader2 className="size-4 animate-spin" />}
              {newApiKey ? 'Done' : 'Create'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
