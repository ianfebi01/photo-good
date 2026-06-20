import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/require'
import Link from 'next/link'
import { ExternalLink, Film, Image, Clapperboard } from 'lucide-react'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SessionRow = {
  session_id : string
  booth_name : string
  booth_location : string | null
  latest_at : string
  expires_at : string
  strip_count : number
  video_count : number
  mashup_count : number
}

export default async function DashboardResultsPage() {
  await requireRole( 'admin' )

  const result = await db.query(
    `SELECT
       r.session_id,
       b.name AS booth_name,
       b.location AS booth_location,
       MAX(r.created_at) AS latest_at,
       MAX(r.expires_at) AS expires_at,
       COUNT(*) FILTER (WHERE r.media_type = 'strip')::int AS strip_count,
       COUNT(*) FILTER (WHERE r.media_type = 'video')::int AS video_count,
       COUNT(*) FILTER (WHERE r.media_type = 'mashup')::int AS mashup_count
     FROM app_results r
     JOIN app_booths b ON r.booth_id = b.id
     WHERE r.session_id IS NOT NULL AND r.expires_at > NOW()
     GROUP BY r.session_id, b.name, b.location
     ORDER BY latest_at DESC
     LIMIT 50`
  )

  const sessions = result.rows as SessionRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Results</h1>
        <p className="mt-0.5 text-xs text-neutral-400">Recent booth sessions and their outputs.</p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-neutral-100 bg-white p-16 text-center">
          <p className="text-sm text-neutral-500">No sessions yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Session</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Booth</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Media</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Expires</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sessions.map( ( s ) => (
                  <tr key={s.session_id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono text-neutral-600">{s.session_id}</code>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-neutral-900">{s.booth_name}</p>
                        {s.booth_location && (
                          <p className="text-xs text-neutral-400">{s.booth_location}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {s.strip_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                            <Image className="size-3" /> {s.strip_count}
                          </span>
                        )}
                        {s.video_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                            <Film className="size-3" /> {s.video_count}
                          </span>
                        )}
                        {s.mashup_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                            <Clapperboard className="size-3" /> {s.mashup_count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-neutral-500">
                      {new Date( s.latest_at ).toLocaleDateString( 'en-US', {
                        month : 'short',
                        day   : 'numeric',
                        hour  : 'numeric',
                        minute : '2-digit',
                      } )}
                    </td>
                    <td className="px-6 py-4 text-xs text-neutral-500">
                      {new Date( s.expires_at ).toLocaleDateString( 'en-US', {
                        month : 'short',
                        day   : 'numeric',
                      } )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/r/${s.session_id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        View <ExternalLink className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ) )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
