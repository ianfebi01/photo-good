import { Inter } from 'next/font/google'

const inter = Inter( {
  subsets  : ['latin'],
  variable : '--font-sans',
} )

export default function AdminLayout( {
  children,
}: {
  children: React.ReactNode
} ) {
  return (
    <div className={`${inter.variable} font-sans min-h-screen`}>
      {children}
    </div>
  )
}
