import { dehydrate, QueryClient } from '@tanstack/react-query'

import Providers from '../providers'
import { BoothClient } from './BoothClient'
import { FRAMES_QUERY_KEY, getFrames } from '@/lib/photobooth/frames.query'

export default async function BoothPage() {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery( { queryKey : FRAMES_QUERY_KEY, queryFn : getFrames } )

  return (
    <Providers dehydratedState={dehydrate( queryClient )}>
      <BoothClient />
    </Providers>
  )
}
