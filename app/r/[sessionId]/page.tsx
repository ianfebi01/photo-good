import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'

import { RESULTS_QUERY_KEY } from '@/lib/photobooth/results.query'
import { getResultsForSsr } from '@/lib/photobooth/results.query.server'
import { ResultView } from '@/components/booth/ResultView'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function ResultPage( {
  params,
} : {
  params : Promise<{ sessionId : string }>
} ) {
  const { sessionId } = await params

  const queryClient = new QueryClient()
  await queryClient.prefetchQuery( {
    queryKey : [...RESULTS_QUERY_KEY, sessionId],
    queryFn  : () => getResultsForSsr( sessionId ),
  } )

  return (
    <HydrationBoundary state={dehydrate( queryClient )}>
      <ResultView sessionId={sessionId} />
    </HydrationBoundary>
  )
}
