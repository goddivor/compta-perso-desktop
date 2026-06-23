import { useState, useEffect } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { fmt, fmtDate, today } from '../../utils/format'
import { Button } from '../ui/Button'
import { Field, Input, Select } from '../ui/Field'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { Plus, CheckCircle, ArrowLeft, Trash2 } from 'lucide-react'

function AddTxRow({ sessionId, accounts, categories, onAdded }) {
  const [form, setForm] = useState({ account_id: accounts?.[0]?.id || '', type: 'DEBIT', amount: '', category_id: '', date: today(), description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filteredCats = (categories || []).filter(c => c.flow === 'BOTH' || c.flow === form.type)

  const save = async () => {
    if (!form.amount || !form.account_id) return
    await window.api.forecast.addTransaction({
      session_id: sessionId,
      account_id: Number(form.account_id),
      type: form.type,
      amount: parseFloat(form.amount),
      category_id: form.category_id ? Number(form.category_id) : null,
      date: form.date,
      description: form.description || null,
    })
    setForm(f => ({ ...f, amount: '', description: '', category_id: '' }))
    onAdded()
  }

  return (
    <div className="bg-gray-800/50 rounded-lg p-3 flex flex-wrap gap-2 items-end border border-edge border-dashed">
      <Select value={form.account_id} onChange={e => set('account_id', e.target.value)} className="w-36 text-xs">
        {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>
      <Select value={form.type} onChange={e => set('type', e.target.value)} className="w-28 text-xs">
        <option value="DEBIT">Débit</option>
        <option value="CREDIT">Crédit</option>
      </Select>
      <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="Montant" className="w-28 text-xs" />
      <Select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="w-32 text-xs">
        <option value="">Catégorie…</option>
        {filteredCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
      </Select>
      <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="w-36 text-xs" />
      <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description" className="w-36 text-xs" />
      <Button size="sm" onClick={save} disabled={!form.amount}><Plus size={12} />Ajouter</Button>
    </div>
  )
}

export function ForecastDetail({ sessionId, onBack, onChanged }) {
  const { data, loading, refetch } = useAsync(() => window.api.forecast.getSession(sessionId), [sessionId])
  const { data: accounts }   = useAsync(() => window.api.accounts.getAll())
  const { data: categories } = useAsync(() => window.api.categories.getAll())
  const [balances, setBalances] = useState({})

  useEffect(() => {
    if (!data?.transactions?.length || !accounts) return
    const map = {}
    for (const a of accounts) map[a.id] = a.current_balance

    // Apply forecast transactions
    const projected = { ...map }
    for (const tx of data.transactions) {
      if (projected[tx.account_id] === undefined) projected[tx.account_id] = 0
      projected[tx.account_id] += tx.type === 'CREDIT' ? tx.amount : -tx.amount
    }
    setBalances({ current: map, projected })
  }, [data, accounts])

  if (loading) return <Spinner />

  const { session, transactions } = data || {}
  const isValidated = !!session?.validated_at
  const net = (transactions || []).reduce((s, tx) => s + (tx.type === 'CREDIT' ? tx.amount : -tx.amount), 0)

  const validate = async () => {
    if (!confirm('Valider cette simulation ? Les transactions deviendront réelles.')) return
    await window.api.forecast.validateSession(sessionId)
    onChanged()
    onBack()
  }

  const removeTx = async (id) => {
    await window.api.transactions.remove(id)
    refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-100">{session?.name}</h2>
          {session?.description && <p className="text-xs text-gray-500">{session.description}</p>}
        </div>
        {isValidated
          ? <span className="text-xs text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">Validée</span>
          : <Button variant="success" onClick={validate}><CheckCircle size={14} />Valider</Button>
        }
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface rounded-lg border border-edge p-4">
          <p className="text-xs text-gray-500 mb-1">Bilan prévisionnel</p>
          <p className={`text-xl font-bold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{net >= 0 ? '+' : ''}{fmt(net)}</p>
        </div>
        <div className="bg-surface rounded-lg border border-edge p-4">
          <p className="text-xs text-gray-500 mb-1">Transactions simulées</p>
          <p className="text-xl font-bold text-gray-100">{transactions?.length || 0}</p>
        </div>
        <div className="bg-surface rounded-lg border border-edge p-4">
          <p className="text-xs text-gray-500 mb-1">Statut</p>
          <p className="text-sm font-medium mt-1">{isValidated ? '✅ Validée' : '⏳ Simulation'}</p>
        </div>
      </div>

      {balances.projected && (
        <div className="bg-surface rounded-lg border border-edge p-4">
          <p className="text-xs text-gray-500 mb-3">Soldes projetés après simulation</p>
          <div className="grid grid-cols-2 gap-2">
            {(accounts || []).map(a => {
              const cur = balances.current?.[a.id] ?? a.current_balance
              const prj = balances.projected?.[a.id] ?? cur
              const diff = prj - cur
              return (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-gray-400 flex-1 truncate">{a.name}</span>
                  <span className="text-gray-300">{fmt(prj)}</span>
                  {diff !== 0 && (
                    <span className={`text-xs ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ({diff > 0 ? '+' : ''}{fmt(diff)})
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-edge overflow-hidden">
        <div className="px-5 py-3 border-b border-edge text-xs text-gray-500 uppercase font-medium">
          Transactions simulées
        </div>
        {(transactions || []).length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">Aucune transaction — ajoutez-en ci-dessous</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b border-edge/50 hover:bg-gray-800/20 group">
                  <td className="px-5 py-3 text-gray-400">{fmtDate(tx.date)}</td>
                  <td className="px-3 py-3 text-gray-300">{tx.description || '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-400">{tx.account_name}</td>
                  <td className="px-3 py-3">
                    {tx.category_name && <Badge color={tx.category_color}>{tx.category_icon} {tx.category_name}</Badge>}
                  </td>
                  <td className={`px-5 py-3 text-right font-medium ${tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                  {!isValidated && (
                    <td className="px-3 py-3">
                      <button onClick={() => removeTx(tx.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-gray-500 hover:text-rose-400 hover:bg-gray-700 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isValidated && (
        <AddTxRow sessionId={sessionId} accounts={accounts} categories={categories} onAdded={refetch} />
      )}
    </div>
  )
}
