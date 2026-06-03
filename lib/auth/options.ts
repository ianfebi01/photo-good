import type { Account, AuthOptions, Profile, Session, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import GoogleProvider from 'next-auth/providers/google'

import { upsertGoogleUser } from '@/lib/auth/users'
import { type Role } from '@/lib/auth/types'

type GoogleProfile = Profile & {
  sub?: string
  picture?: string
}

type TokenWithUser = JWT & {
  user?: {
    id: string
    name: string
    email: string
    image?: string | null
    role: Role
  }
}

export const authOptions: AuthOptions = {
  secret    : process.env.NEXTAUTH_SECRET ?? 'photo-good-local-development-secret',
  providers : [
    GoogleProvider( {
      clientId     : process.env.GOOGLE_CLIENT_ID!,
      clientSecret : process.env.GOOGLE_CLIENT_SECRET!,
    } ),
  ],
  session : {
    strategy  : 'jwt',
    maxAge    : 30 * 24 * 60 * 60,
    updateAge : 24 * 60 * 60,
  },
  callbacks : {
    async signIn( { profile } ) {
      const googleProfile = profile as GoogleProfile | undefined

      if ( !googleProfile?.email || !googleProfile.sub ) {
        return false
      }

      await upsertGoogleUser( {
        email     : googleProfile.email,
        name      : googleProfile.name ?? googleProfile.email,
        googleId  : googleProfile.sub,
        avatarUrl : googleProfile.picture ?? null,
      } )

      return true
    },
    async jwt( {
      token,
      account,
      profile,
      user,
    }: {
      token: TokenWithUser
      account?: Account | null
      profile?: GoogleProfile
      user?: User
    } ) {
      if ( account && profile?.email && profile.sub ) {
        const dbUser = await upsertGoogleUser( {
          email     : profile.email,
          name      : profile.name ?? user?.name ?? profile.email,
          googleId  : profile.sub,
          avatarUrl : profile.picture ?? user?.image ?? null,
        } )

        token.user = {
          id    : dbUser.id,
          name  : dbUser.name,
          email : dbUser.email,
          image : dbUser.image,
          role  : dbUser.role,
        }
      }

      return token
    },
    async session( {
      session,
      token,
    }: {
      session: Session
      token: TokenWithUser
    } ) {
      if ( token.user ) {
        session.user = token.user
      }

      return session
    },
  },
  pages : {
    signIn : '/login',
    error  : '/login',
  },
}
