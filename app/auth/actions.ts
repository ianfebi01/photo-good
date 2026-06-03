'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '@/lib/auth/session'
import {
  updateUserProfile,
  updateUserRole,
} from '@/lib/auth/users'
import { hasRole } from '@/lib/auth/types'

function getString( formData: FormData, key: string ) {
  const value = formData.get( key )

  return typeof value === 'string' ? value.trim() : ''
}

export async function logoutAction() {
  redirect( '/api/auth/signout?callbackUrl=/login' )
}

export async function updateProfileAction( formData: FormData ) {
  const user = await getCurrentUser()
  if ( !user ) redirect( '/login' )

  const name = getString( formData, 'name' )
  const email = getString( formData, 'email' )

  if ( name.length >= 2 && email.includes( '@' ) ) {
    await updateUserProfile( user.id, { name, email } )
    revalidatePath( '/dashboard/profile' )
    revalidatePath( '/dashboard' )
  }
}

export async function updateRoleAction( formData: FormData ) {
  const currentUser = await getCurrentUser()
  if ( !currentUser ) redirect( '/login' )
  if ( !hasRole( currentUser.role, 'super_admin' ) ) redirect( '/dashboard' )

  const userId = getString( formData, 'userId' )
  const role = getString( formData, 'role' )

  if ( userId && userId !== currentUser.id ) {
    await updateUserRole( userId, role )
    revalidatePath( '/dashboard/users' )
  }
}
