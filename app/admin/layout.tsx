import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { requireRole } from '@/lib/auth/require'

const inter = Inter( {
  subsets  : ['latin'],
  variable : '--font-sans',
} )

export const metadata: Metadata = {
  title       : "Admin — Photo Good",
  description : "Photo Good admin panel for managing frames, booths, users, and results.",
}

export default async function AdminLayout( {
  children,
}: {
  children: React.ReactNode
} ) {
  await requireRole( 'admin' )

  return (
    <div className={`${inter.variable} font-sans min-h-screen`}>
      {children}
    </div>
  )
}
