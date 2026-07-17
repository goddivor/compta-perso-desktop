import { useAsync } from '../hooks/useAsync'
import { fmt } from '../utils/format'
import { Spinner } from './ui/Spinner'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function formatDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export function DailyReport({ filters, tick }) {
  const params = {}
  if (filters.account_id)  params.account_id = Number(filters.account_id)
  if (filters.date_from)   params.date_from  = filters.date_from
  if (filters.date_to)     params.date_to    = filters.date_to

  const { data, loading } = useAsync(
    () => window.api.stats.getDailyReport(params),
    [tick, filters.account_id, filters.date_from, filters.date_to]
  )

  const rows = data || []

  const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0)
  const totalDebit  = rows.reduce((s, r) => s + r.total_debit, 0)
  const totalNet    = totalCredit - totalDebit

  if (loading) return (
    <div className="flex items-center justify-center h-full"><Spinner /></div>
  )

  if (!rows.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-faint">
      <Minus size={28} />
      <p className="text-sm">Aucune transaction sur la période</p>
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Bande récap en haut */}
      <div className="shrink-0 flex items-center gap-0 border-b border-edge bg-surface">
        <div className="flex flex-col px-6 py-3 border-r border-edge">
          <span className="text-xs text-muted mb-0.5">{rows.length} jour{rows.length > 1 ? 's' : ''}</span>
          <span className="text-sm font-semibold text-content">{rows.reduce((s, r) => s + r.tx_count, 0)} transactions</span>
        </div>
        <div className="flex flex-col px-6 py-3 border-r border-edge">
          <span className="text-xs text-muted mb-0.5">Total entré</span>
          <span className="text-sm font-bold text-emerald-400">+{fmt(totalCredit)}</span>
        </div>
        <div className="flex flex-col px-6 py-3 border-r border-edge">
          <span className="text-xs text-muted mb-0.5">Total sorti</span>
          <span className="text-sm font-bold text-rose-400">-{fmt(totalDebit)}</span>
        </div>
        <div className="flex flex-col px-6 py-3">
          <span className="text-xs text-muted mb-0.5">Bilan net</span>
          <span className={`text-sm font-bold ${totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalNet >= 0 ? '+' : ''}{fmt(totalNet)}
          </span>
        </div>
      </div>

      {/* Liste des jours */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-base z-10">
            <tr className="border-b border-edge text-xs text-muted uppercase tracking-wide">
              <th className="text-left px-6 py-2.5 font-medium">Date</th>
              <th className="text-right px-4 py-2.5 font-medium text-emerald-600">Entré</th>
              <th className="text-right px-4 py-2.5 font-medium text-rose-600">Sorti</th>
              <th className="text-right px-6 py-2.5 font-medium">Bilan</th>
              <th className="text-right px-6 py-2.5 font-medium">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const net = row.net
              return (
                <tr key={row.day} className="border-b border-edge/50 hover:bg-surface2/60 transition-colors group">
                  <td className="px-6 py-3">
                    <span className="text-sm text-content font-medium">{formatDay(row.day)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.total_credit > 0 ? (
                      <span className="text-sm font-mono text-emerald-400">+{fmt(row.total_credit)}</span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.total_debit > 0 ? (
                      <span className="text-sm font-mono text-rose-400">-{fmt(row.total_debit)}</span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {net > 0
                        ? <TrendingUp size={13} className="text-emerald-500" />
                        : net < 0
                        ? <TrendingDown size={13} className="text-rose-500" />
                        : <Minus size={13} className="text-faint" />}
                      <span className={`text-sm font-bold font-mono ${
                        net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : 'text-muted'
                      }`}>
                        {net > 0 ? '+' : ''}{fmt(net)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-xs text-muted bg-surface2 rounded-full px-2 py-0.5">
                      {row.tx_count}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
