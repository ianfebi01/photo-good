import { FramesManager } from '@/components/dashboard/FramesManager'
import { requireRole } from '@/lib/auth/require'

export default async function DashboardFramesPage() {
  await requireRole( 'admin' )

  return <FramesManager />
}
