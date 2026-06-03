import Link from 'next/link'
import {
  Camera,
  Images,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'

import { logoutAction } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { hasRole, type AuthUser } from '@/lib/auth/types'

const navItems = [
  { href : '/dashboard', label : 'Dashboard', icon : LayoutDashboard },
  { href : '/admin', label : 'Frames', icon : Images, role : 'admin' as const },
  { href : '/dashboard/profile', label : 'Profile', icon : User },
  { href : '/dashboard/users', label : 'Users', icon : Users, role : 'super_admin' as const },
]

export function DashboardShell( {
  user,
  children,
}: {
  user: AuthUser
  children: React.ReactNode
} ) {
  return (
    <main className="min-h-screen bg-secondary/45 p-3 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:min-h-[calc(100vh-3rem)] lg:flex-row">
        <aside className="flex flex-col rounded-3xl bg-white p-4 shadow-xl lg:w-72">
          <Link
            href="/dashboard"
            className="mb-6 flex items-center gap-3 px-2"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-white">
              <Camera className="size-5" />
            </span>
            <span className="text-xl font-bold text-foreground">photo good.</span>
          </Link>

          <nav className="grid gap-2">
            {navItems.map( ( item ) => {
              if ( item.role && !hasRole( user.role, item.role ) ) return null
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-muted-foreground transition hover:bg-secondary hover:text-primary"
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            } )}
          </nav>

          <div className="mt-auto pt-6">
            <div className="rounded-3xl bg-secondary p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold uppercase text-white">
                  {user.name.slice( 0, 1 )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                <ShieldCheck className="size-3" />
                {user.role.replace( '_', ' ' )}
              </div>
              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full justify-start rounded-xl font-bold"
                >
                  <LogOut className="size-4" />
                  Logout
                </Button>
              </form>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 rounded-3xl bg-white p-4 shadow-xl md:p-6 lg:p-8">
          {children}
        </section>
      </div>
    </main>
  )
}
