import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/require'
import { CreditCard, CheckCircle2, Clock, XCircle, AlertTriangle, Ban } from 'lucide-react'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PaymentRow = {
  order_id : string
  transaction_id : string | null
  session_id : string
  booth_name : string
  gross_amount : number
  payment_type : string
  transaction_status : string
  created_at : string
  updated_at : string
}

const STATUS_STYLES : Record<string, { label : string; color : string; icon : React.ComponentType<{ className? : string }> }> = {
  settlement : { label : 'Paid', color : 'text-emerald-700 bg-emerald-50 border-emerald-100', icon : CheckCircle2 },
  pending    : { label : 'Pending', color : 'text-amber-700 bg-amber-50 border-amber-100', icon : Clock },
  expire     : { label : 'Expired', color : 'text-neutral-600 bg-neutral-100 border-neutral-200', icon : Clock },
  cancel     : { label : 'Cancelled', color : 'text-neutral-600 bg-neutral-100 border-neutral-200', icon : XCircle },
  deny       : { label : 'Denied', color : 'text-red-700 bg-red-50 border-red-100', icon : Ban },
  refund     : { label : 'Refunded', color : 'text-blue-700 bg-blue-50 border-blue-100', icon : AlertTriangle },
  failure    : { label : 'Failed', color : 'text-red-700 bg-red-50 border-red-100', icon : XCircle },
}

function formatStatus( status : string ) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  const Icon = s.icon

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
      <Icon className="size-3" />
      {s.label}
    </span>
  )
}

function formatRupiah( amount : number ) {
  return `Rp ${amount.toLocaleString( 'id-ID' )}`
}

export default async function DashboardPaymentsPage() {
  await requireRole( 'admin' )

  const result = await db.query(
    `SELECT
       p.order_id,
       p.transaction_id,
       p.session_id,
       b.name AS booth_name,
       p.gross_amount,
       p.payment_type,
       p.transaction_status,
       p.created_at,
       p.updated_at
     FROM app_payments p
     JOIN app_booths b ON p.booth_id = b.id
     ORDER BY p.created_at DESC
     LIMIT 100`
  )

  const payments = result.rows as PaymentRow[]
  const totalRevenue = payments
    .filter( ( p ) => p.transaction_status === 'settlement' )
    .reduce( ( sum, p ) => sum + p.gross_amount, 0 )

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="mt-0.5 text-xs text-neutral-400">QRIS transactions from booth clients.</p>
        </div>
        {totalRevenue > 0 && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Revenue</p>
            <p className="text-lg font-bold text-emerald-800">{formatRupiah( totalRevenue )}</p>
          </div>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="rounded-2xl border border-neutral-100 bg-white p-16 text-center">
          <CreditCard className="mx-auto size-8 text-neutral-300" />
          <p className="mt-3 text-sm text-neutral-500">No payments yet.</p>
          <p className="text-xs text-neutral-400">Transactions will appear here once booth clients create QRIS charges.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Booth</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Session</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {payments.map( ( p ) => (
                  <tr key={p.order_id}
                    className="hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono text-neutral-600">{p.order_id}</code>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-neutral-900">{p.booth_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono text-neutral-500">{p.session_id}</code>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-semibold text-neutral-900">{formatRupiah( p.gross_amount )}</p>
                      <p className="text-[10px] text-neutral-400 uppercase">{p.payment_type}</p>
                    </td>
                    <td className="px-6 py-4">
                      {formatStatus( p.transaction_status )}
                    </td>
                    <td className="px-6 py-4 text-xs text-neutral-500">
                      {new Date( p.created_at ).toLocaleDateString( 'en-US', {
                        month  : 'short',
                        day    : 'numeric',
                        hour   : 'numeric',
                        minute : '2-digit',
                      } )}
                    </td>
                    <td className="px-6 py-4 text-xs text-neutral-500">
                      {new Date( p.updated_at ).toLocaleDateString( 'en-US', {
                        month  : 'short',
                        day    : 'numeric',
                        hour   : 'numeric',
                        minute : '2-digit',
                      } )}
                    </td>
                  </tr>
                ) ) }
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
