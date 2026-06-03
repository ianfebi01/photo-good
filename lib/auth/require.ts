import 'server-only'

import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/session'
import { hasRole, type Role } from '@/lib/auth/types'

export async function requireUser() {
  const user = await getCurrentUser()
  if ( !user ) redirect( '/login' )

  return user
}

export async function requireRole( role: Role ) {
  const user = await requireUser()
  if ( !hasRole( user.role, role ) ) redirect( '/dashboard' )

  return user
}
