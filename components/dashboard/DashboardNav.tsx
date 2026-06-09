'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Images, LayoutDashboard, User, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
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
              buttonVariants( {
                variant : isActive ? 'secondary' : 'ghost',
                size    : 'sm',
              } ),
              'w-full justify-start',
            )}
          >
            <Icon className="size-3 shrink-0" />
            {item.label}
          </Link>
        )
      } )}
    </nav>
  )
}
