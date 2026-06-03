import Link from 'next/link'
import { Camera, LogOut, ShieldCheck } from 'lucide-react'

import { logoutAction } from '@/app/auth/actions'
import { type AuthUser } from '@/lib/auth/types'
import { DashboardNav } from './DashboardNav'

export function DashboardShell( {
  user,
  children,
}: {
  user: AuthUser
  children: React.ReactNode
} ) {
  return (
    <div className="flex min-h-screen bg-neutral-100 font-jakarta">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="p-5 pb-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <div
              className="group relative flex size-8 items-center justify-center cursor-pointer disabled:cursor-not-allowed select-none rounded-full focus:outline-none disabled:opacity-50"
              title="Snap"
            >
              <span className="absolute inset-0 rounded-full border-2 border-primary" />
              <span className="absolute inset-1 rounded-full bg-primary transition-transform duration-150 group-hover:scale-105 group-active:scale-90 group-disabled:scale-100" >
              </span>
            </div>
            <span className="text-lg font-bold text-neutral-900 font-sans">photo good.</span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400 font-sans">
            Menu
          </p>
          <DashboardNav user={user} />
        </div>

        <div className="border-t border-neutral-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold uppercase text-white">
              {user.name.slice( 0, 1 )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">{user.name}</p>
              <p className="truncate text-xs text-neutral-400">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Logout"
                className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            <ShieldCheck className="size-3" />
            {user.role.replace( '_', ' ' )}
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-20 flex h-14 items-center border-b border-neutral-200 bg-white px-4 lg:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
        >
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-primary"
          >
            <Camera className="size-3.5 text-white" />
          </span>
          <span className="text-base font-bold text-neutral-900">photo good.</span>
        </Link>
      </div>

      {/* Main content */}
      <main className="min-w-0 flex-1 p-5 pt-20 lg:p-8 lg:pt-8">
        {children}
      </main>
    </div>
  )
}
