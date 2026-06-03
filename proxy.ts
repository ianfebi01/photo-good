import { NextResponse, type NextRequest } from 'next/server'

const protectedPrefixes = ['/dashboard', '/admin']
const guestOnlyPaths = ['/login', '/signup']

export function proxy( request: NextRequest ) {
  const { pathname } = request.nextUrl
  const hasSession = Boolean(
    request.cookies.get( 'next-auth.session-token' )?.value ||
      request.cookies.get( '__Secure-next-auth.session-token' )?.value,
  )

  if ( protectedPrefixes.some( ( prefix ) => pathname.startsWith( prefix ) ) && !hasSession ) {
    const loginUrl = new URL( '/login', request.url )
    loginUrl.searchParams.set( 'next', pathname )

    return NextResponse.redirect( loginUrl )
  }

  if ( guestOnlyPaths.includes( pathname ) && hasSession ) {
    return NextResponse.redirect( new URL( '/dashboard', request.url ) )
  }

  return NextResponse.next()
}

export const config = {
  matcher : [
    '/dashboard/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
  ],
}
