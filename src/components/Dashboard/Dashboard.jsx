import { useAsync } from '../../hooks/useAsync'
import { fmt, fmtDate } from '../../utils/format'
import { Spinner } from '../ui/Spinner'
import { TypeBadge } from '../ui/Badge'
import { Wallet, CreditCard, TrendingUp, ArrowUpDown } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-lg font-bold text-gray-100">{value}</p>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { data: summary, loading } = useAsync(() => window.api.stats.getSummary())
  const { data: txs } = useAsync(() => window.api.transactions.getAll({ include_forecast: false }))

  if (loading) return <Spinner />

  const total = (summary?.total_electronic ?? 0) + (summary?.total_physical ?? 0)
  const recent = (txs || []).slice(0, 10)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-100">Tableau de bord</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={TrendingUp}  label="Solde total"       value={fmt(total)}                          color="bg-blue-600" />
        <StatCard icon={CreditCard}  label="Monnaie électronique" value={fmt(summary?.total_electronic ?? 0)} color="bg-violet-600" />
        <StatCard icon={Wallet}      label="Monnaie physique"  value={fmt(summary?.total_physical ?? 0)}   color="bg-emerald-600" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(summary?.accounts || []).map(a => (
          <div key={a.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: a.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{a.name}</p>
              {a.provider && <p className="text-xs text-gray-500">{a.provider}</p>}
            </div>
            <p className={`text-sm font-bold ${a.current_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmt(a.current_balance)}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <ArrowUpDown size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-200">Transactions récentes</h2>
        </div>
        {recent.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">Aucune transaction</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {recent.map(tx => (
                <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 text-gray-400">{fmtDate(tx.date)}</td>
                  <td className="px-3 py-3 text-gray-300">{tx.description || tx.category_name || '—'}</td>
                  <td className="px-3 py-3 text-gray-400 text-xs">{tx.account_name}</td>
                  <td className="px-5 py-3 text-right">
                    <TypeBadge type={tx.type} />
                  </td>
                  <td className={`px-5 py-3 text-right font-medium ${tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
