'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Images, LayoutDashboard, User, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { hasRole, type AuthUser } from '@/lib/auth/types'

const navItems = [
  { href : '/dashboard', label : 'Dashboard', icon : LayoutDashboard },
  { href : '/dashboard/frames', label : 'Frames', icon : Images, role : 'admin' as const },
  { href : '/dashboard/profile', label : 'Profile', icon : User },
  { href : '/dashboard/users', label : 'Users', icon : Users, role : 'super_admin' as const },
]

export function DashboardNav( { user }: { user: AuthUser } ) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map( ( item ) => {
        if ( item.role && !hasRole( user.role, item.role ) ) return null
        const Icon = item.icon
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-primary text-white'
                : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        )
      } )}
    </nav>
  )
}
