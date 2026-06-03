import Link from 'next/link'
import { ArrowRight, Camera, Images, ShieldCheck, Sparkles } from 'lucide-react'

import { requireUser } from '@/lib/auth/require'
import { hasRole } from '@/lib/auth/types'

export default async function DashboardPage() {
  const user = await requireUser()

  const dateLabel = new Date().toLocaleDateString( 'en-US', {
    weekday : 'long',
    year    : 'numeric',
    month   : 'long',
    day     : 'numeric',
  } )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs text-neutral-400 font-sans">{dateLabel}</p>
          <h1 className="mt-1 text-xl font-bold text-neutral-900">
            Welcome back,{' '}
            <span className="font-sans text-2xl">{user.name.split( ' ' )[0]}</span>
          </h1>
        </div>
        <Link
          href="/booth"
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-sans font-semibold text-white transition hover:bg-primary/90"
        >
          <Camera className="size-4" />
          Open Booth
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex size-9 items-center justify-center rounded-xl bg-secondary">
              <Sparkles className="size-4 text-neutral-600" />
            </div>
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-600">
              Active
            </span>
          </div>
          <p className="text-lg font-bold text-neutral-900 font-sans">Live</p>
          <p className="mt-0.5 text-xs text-neutral-400">Booth tools are ready</p>
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent/40">
              <Images className="size-4 text-neutral-600" />
            </div>
          </div>
          <p className="text-lg font-bold text-neutral-900 font-sans">Frames</p>
          <p className="mt-0.5 text-xs text-neutral-400">Upload & review templates</p>
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <div className="mb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-neutral-100">
              <ShieldCheck className="size-4 text-neutral-600" />
            </div>
          </div>
          <p className="text-lg font-bold capitalize text-neutral-900 font-sans">
            {user.role.replace( '_', ' ' )}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">Your active RBAC role</p>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Quick actions */}
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
          <h2 className="text-xl font-bold text-neutral-900 font-sans">Quick Actions</h2>
          <p className="mt-0.5 text-xs text-neutral-400">Common booth management tasks</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              href="/booth"
              className="group flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 p-4 transition hover:border-neutral-200 hover:bg-neutral-100"
            >
              <div>
                <p className="text-xs font-semibold text-neutral-900">Start a capture session</p>
                <p className="mt-0.5 text-[0.625rem] text-neutral-400">Open the photo booth</p>
              </div>
              <ArrowRight className="size-4 text-neutral-300 transition group-hover:text-neutral-600" />
            </Link>

            {hasRole( user.role, 'admin' ) && (
              <Link
                href="/dashboard/frames"
                className="group flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 p-4 transition hover:border-neutral-200 hover:bg-neutral-100"
              >
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Manage frame templates</p>
                  <p className="mt-0.5 text-[0.625rem] text-neutral-400">Upload and review frames</p>
                </div>
                <ArrowRight className="size-4 text-neutral-300 transition group-hover:text-neutral-600" />
              </Link>
            )}

            <Link
              href="/dashboard/profile"
              className="group flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 p-4 transition hover:border-neutral-200 hover:bg-neutral-100"
            >
              <div>
                <p className="text-xs font-semibold text-neutral-900">Update profile</p>
                <p className="mt-0.5 text-[0.625rem] text-neutral-400">Edit your account info</p>
              </div>
              <ArrowRight className="size-4 text-neutral-300 transition group-hover:text-neutral-600" />
            </Link>

            {hasRole( user.role, 'super_admin' ) && (
              <Link
                href="/dashboard/users"
                className="group flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 p-4 transition hover:border-neutral-200 hover:bg-neutral-100"
              >
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Manage team roles</p>
                  <p className="mt-0.5 text-[0.625rem] text-neutral-400">Control user access</p>
                </div>
                <ArrowRight className="size-4 text-neutral-300 transition group-hover:text-neutral-600" />
              </Link>
            )}
          </div>
        </div>

        {/* Access control card */}
        <div className="rounded-2xl bg-primary p-5 text-white">
          <h2 className="text-xl font-bold font-sans">Access Control</h2>
          <p className="mt-2 text-xs leading-5 text-white/70">
            Super admins manage users & roles. Admins control booth frames. Operators and viewers
            keep dashboard access without admin controls.
          </p>
          <div className="mt-4">
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold capitalize">
              <ShieldCheck className="size-3.5" />
              {user.role.replace( '_', ' ' )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
