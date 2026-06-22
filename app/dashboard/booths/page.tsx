import type { Metadata } from 'next'
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'

import { BoothsManager } from '@/components/dashboard/BoothsManager'
import { BOOTHS_QUERY_KEY } from '@/lib/photobooth/booths.query'
import { getBoothsForSsr } from '@/lib/photobooth/booths.query.server'
import { requireRole } from '@/lib/auth/require'

export const metadata: Metadata = {
  title       : "Booths — Photo Good",
  description : "Manage photo booth locations, API keys, and configuration from the dashboard.",
}

export default async function DashboardBoothsPage() {
  await requireRole( 'admin' )

  const queryClient = new QueryClient()
  await queryClient.prefetchQuery( {
    queryKey : BOOTHS_QUERY_KEY,
    queryFn  : getBoothsForSsr,
  } )

  return (
    <HydrationBoundary state={dehydrate( queryClient )}>
      <BoothsManager />
    </HydrationBoundary>
  )
}
