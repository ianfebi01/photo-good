import Link from 'next/link'
import { Camera, Images, ShieldCheck, Sparkles } from 'lucide-react'

import AppCard from '@/components/AppCard'
import { requireUser } from '@/lib/auth/require'
import { hasRole } from '@/lib/auth/types'

export default async function DashboardPage() {
  const user = await requireUser()

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Dashboard
          </p>
          <h1 className="mt-2 text-4xl font-bold text-foreground">
            Welcome, {user.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground font-poppins">
            Manage booth operations, frame templates, and team access from one
            secure workspace.
          </p>
        </div>
        <Link
          href="/booth"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-primary/90"
        >
          <Camera className="size-4" />
          Open Booth
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AppCard className="bg-primary text-white">
          <Sparkles className="mb-5 size-6" />
          <p className="text-3xl font-bold">Live</p>
          <p className="mt-1 text-sm text-white/70 font-poppins">
            Booth tools are ready.
          </p>
        </AppCard>
        <AppCard className="bg-secondary text-secondary-foreground">
          <Images className="mb-5 size-6 text-primary" />
          <p className="text-3xl font-bold">Frames</p>
          <p className="mt-1 text-sm text-muted-foreground font-poppins">
            Upload and review templates.
          </p>
        </AppCard>
        <AppCard className="bg-accent text-accent-foreground">
          <ShieldCheck className="mb-5 size-6" />
          <p className="text-3xl font-bold">
            {user.role.replace( '_', ' ' )}
          </p>
          <p className="mt-1 text-sm text-accent-foreground/70 font-poppins">
            Active RBAC role.
          </p>
        </AppCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <AppCard>
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Quick actions
              </h2>
              <p className="text-sm text-muted-foreground font-poppins">
                Common booth management tasks.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/booth"
              className="rounded-2xl bg-secondary p-4 text-sm font-bold text-foreground transition hover:bg-secondary/80"
            >
              Start a capture session
            </Link>
            {hasRole( user.role, 'admin' ) && (
              <Link
                href="/admin"
                className="rounded-2xl bg-secondary p-4 text-sm font-bold text-foreground transition hover:bg-secondary/80"
              >
                Manage frame templates
              </Link>
            )}
            <Link
              href="/dashboard/profile"
              className="rounded-2xl bg-secondary p-4 text-sm font-bold text-foreground transition hover:bg-secondary/80"
            >
              Update profile
            </Link>
            {hasRole( user.role, 'super_admin' ) && (
              <Link
                href="/dashboard/users"
                className="rounded-2xl bg-secondary p-4 text-sm font-bold text-foreground transition hover:bg-secondary/80"
              >
                Manage team roles
              </Link>
            )}
          </div>
        </AppCard>

        <AppCard className="bg-chart-2 text-white">
          <h2 className="text-xl font-bold">RBAC</h2>
          <p className="mt-3 text-sm leading-6 text-white/75 font-poppins">
            Super admins can manage users and roles. Admins can manage booth
            frames. Operators and viewers keep dashboard access without admin
            controls.
          </p>
        </AppCard>
      </div>
    </div>
  )
}
