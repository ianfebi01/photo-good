import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'

import { BoothSettingsPanel } from '@/components/dashboard/BoothSettingsPanel'
import { BOOTH_QUERY_KEY } from '@/lib/photobooth/booths.query'
import { getBoothForSsr } from '@/lib/photobooth/booths.query.server'
import { FRAMES_PAGE_SIZE, FRAMES_QUERY_KEY } from '@/lib/photobooth/frames.query'
import { getFramesForSsr } from '@/lib/photobooth/frames.query.server'
import { requireRole } from '@/lib/auth/require'

export const metadata: Metadata = {
  title       : "Booth settings — Photo Good",
  description : "Configure a booth's client experience and frame availability.",
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function DashboardBoothSettingsPage( {
  params,
} : {
  params : Promise<{ id : string }>
} ) {
  await requireRole( 'admin' )

  const { id } = await params
  if ( !UUID_RE.test( id ) ) notFound()

  const booth = await getBoothForSsr( id )
  if ( !booth ) notFound()

  const queryClient = new QueryClient()
  queryClient.setQueryData( [...BOOTH_QUERY_KEY, id], booth )
  await queryClient.prefetchQuery( {
    queryKey : [...FRAMES_QUERY_KEY, { page : 1, limit : FRAMES_PAGE_SIZE }],
    queryFn  : () => getFramesForSsr( { page : 1, limit : FRAMES_PAGE_SIZE } ),
  } )

  return (
    <HydrationBoundary state={dehydrate( queryClient )}>
      <BoothSettingsPanel boothId={id} />
    </HydrationBoundary>
  )
}
