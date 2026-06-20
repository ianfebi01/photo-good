import type { BoothMediaType } from '@/types/booth'

export const RESULTS_QUERY_KEY = ['booth', 'results'] as const

export type ResultRow = {
  media_type : BoothMediaType
  url : string
  frame_key : string | null
  expires_at : string
  booth_name : string
}

export type SessionResults = {
  sessionId : string
  boothName : string
  results : ResultRow[]
}

export async function getResults( sessionId : string ) : Promise<SessionResults | null> {
  const res = await fetch( `/api/booth/results?sessionId=${encodeURIComponent( sessionId )}` )
  if ( !res.ok ) {
    if ( res.status === 404 ) return null
    const data = await res.json().catch( () => null )
    throw new Error( data?.error ?? 'Failed to load results' )
  }
  
  return res.json()
}
