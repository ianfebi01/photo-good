import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'

import { FramesManager } from '@/components/dashboard/FramesManager'
import { FRAMES_QUERY_KEY } from '@/lib/photobooth/frames.query'
import { getFramesForSsr } from '@/lib/photobooth/frames.query.server'
import { requireRole } from '@/lib/auth/require'

export default async function DashboardFramesPage() {
  await requireRole( 'admin' )

  const queryClient = new QueryClient()
  await queryClient.prefetchQuery( {
    queryKey : FRAMES_QUERY_KEY,
    queryFn  : getFramesForSsr,
  } )

  return (
    <HydrationBoundary state={dehydrate( queryClient )}>
      <FramesManager />
    </HydrationBoundary>
  )
}
