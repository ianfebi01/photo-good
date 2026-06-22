import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { requireUser } from '@/lib/auth/require'

export const metadata: Metadata = {
  title       : "Dashboard — Photo Good",
  description : "Manage your photo booth, frames, and account from the Photo Good dashboard.",
}

export default async function DashboardLayout( {
  children,
}: {
  children: React.ReactNode
} ) {
  const user = await requireUser()

  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  )
}
