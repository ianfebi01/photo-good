import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { requireUser } from '@/lib/auth/require'

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
