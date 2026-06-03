import 'server-only'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth/options'
import { type AuthUser } from '@/lib/auth/types'

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getServerSession( authOptions )
  if ( !session?.user ) return null

  return {
    id        : session.user.id,
    email     : session.user.email,
    name      : session.user.name,
    role      : session.user.role,
    image     : session.user.image,
    createdAt : new Date(),
    updatedAt : new Date(),
  }
}
