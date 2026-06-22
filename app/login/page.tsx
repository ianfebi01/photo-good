import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { getCurrentUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title       : "Sign In — Photo Good",
  description : "Sign in to Photo Good to manage your photo booth, frames, and dashboard access.",
}

export default async function LoginPage() {
  const user = await getCurrentUser()
  if ( user ) redirect( '/dashboard' )

  return (
    <main className="min-h-screen bg-white px-4 py-8 flex items-center justify-center">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-secondary shadow-xl md:grid-cols-[1fr_1.1fr]">
        <div className="relative hidden min-h-140 flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground md:flex">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 text-lg font-bold">photo good.</div>
          <div className="relative z-10 space-y-4">
            <p className="max-w-sm text-5xl font-bold leading-tight">
              Manage every booth moment securely.
            </p>
            <p className="max-w-xs text-sm leading-6 text-white/70 font-poppins">
              Sign in with Google to access the dashboard, frames, users, and
              RBAC controls.
            </p>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-10 flex flex-col justify-center">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Dashboard access
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground">
              Sign in to Photo Good
            </h1>
            <p className="mt-2 text-sm text-neutral-400 font-poppins">
              Manage your photo booth frames, view captured photos, and control user access with ease.
            </p>
          </div>
          <GoogleSignInButton />
        </div>
      </div>
    </main>
  )
}
