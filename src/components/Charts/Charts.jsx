import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { fmt, fmtDate, fmtMonth } from '../../utils/format'
import { Spinner, Empty } from '../ui/Spinner'
import { Select } from '../ui/Field'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
)

const chartOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#9CA3AF', font: { size: 12 } } } },
  scales: {
    x: { ticks: { color: '#6B7280' }, grid: { color: '#1F2937' } },
    y: { ticks: { color: '#6B7280', callback: v => v.toLocaleString('fr-FR') }, grid: { color: '#1F2937' } }
  }
}

export function Charts() {
  const [accountId, setAccountId] = useState('')
  const { data: accounts } = useAsync(() => window.api.accounts.getAll())

  const { data: history, loading: l1 } = useAsync(
    () => window.api.stats.getBalanceHistory({ account_id: accountId ? Number(accountId) : null, days: 90 }),
    [accountId]
  )
  const { data: byCategory, loading: l2 } = useAsync(
    () => window.api.stats.getExpensesByCategory({ account_id: accountId ? Number(accountId) : undefined }),
    [accountId]
  )
  const { data: monthly, loading: l3 } = useAsync(
    () => window.api.stats.getMonthlyFlow({ account_id: accountId ? Number(accountId) : undefined }),
    [accountId]
  )

  const balanceData = {
    labels: (history || []).map(p => fmtDate(p.date)),
    datasets: [{
      label: 'Solde',
      data: (history || []).map(p => p.balance),
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    }]
  }

  const catData = {
    labels: (byCategory || []).map(c => `${c.icon} ${c.name}`),
    datasets: [{
      data: (byCategory || []).map(c => c.total),
      backgroundColor: (byCategory || []).map(c => c.color + 'CC'),
      borderColor: (byCategory || []).map(c => c.color),
      borderWidth: 1,
    }]
  }

  const monthlyData = {
    labels: (monthly || []).map(m => fmtMonth(m.month)),
    datasets: [
      { label: 'Revenus', data: (monthly || []).map(m => m.income),   backgroundColor: '#10B981CC' },
      { label: 'Dépenses', data: (monthly || []).map(m => m.expenses), backgroundColor: '#EF4444CC' },
    ]
  }

  const noScales = {
    ...chartOpts,
    scales: undefined,
    plugins: {
      legend: { position: 'right', labels: { color: '#9CA3AF', font: { size: 11 }, boxWidth: 12, padding: 8 } }
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Graphiques</h1>
        <Select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-48">
          <option value="">Tous les comptes</option>
          {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </div>

      <div className="bg-surface rounded-xl border border-edge p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Évolution du solde</h2>
        {l1 ? <Spinner /> : (history || []).length < 2 ? <Empty label="Pas assez de données" /> : (
          <div className="h-56">
            <Line data={balanceData} options={chartOpts} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl border border-edge p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Dépenses par catégorie</h2>
          {l2 ? <Spinner /> : (byCategory || []).length === 0 ? <Empty label="Aucune dépense" /> : (
            <div className="h-52">
              <Doughnut data={catData} options={noScales} />
            </div>
          )}
        </div>

        <div className="bg-surface rounded-xl border border-edge p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Revenus vs Dépenses (mensuel)</h2>
          {l3 ? <Spinner /> : (monthly || []).length === 0 ? <Empty label="Aucune donnée mensuelle" /> : (
            <div className="h-52">
              <Bar data={monthlyData} options={chartOpts} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
