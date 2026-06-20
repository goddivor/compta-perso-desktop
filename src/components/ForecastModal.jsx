import { useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Field'
import { Badge } from './ui/Badge'
import { Spinner } from './ui/Spinner'
import { fmt, fmtDate, today } from '../utils/format'
import { Plus, ChevronRight, ChevronDown, CheckCircle, Trash2, GitBranch } from 'lucide-react'

const emptyTx = (accounts) => ({
  account_id:        accounts?.[0]?.id || '',
  type:              'DEBIT',
  amount:            '',
  category_id:       '',
  date:              today(),
  description:       '',
  linked_account_id: '',
  fees:              '',
})

function SessionDetail({ session, accounts, categories, onChanged }) {
  const { data, loading, refetch } = useAsync(
    () => window.api.forecast.getSession(session.id), [session.id]
  )
  const [form, setForm] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filteredCats = (categories || []).filter(
    c => c.flow === 'BOTH' || c.flow === (form?.type || 'DEBIT')
  )

  const addTx = async () => {
    if (!form?.amount || !form?.account_id) return
    const amount = parseFloat(form.amount)
    const fees   = parseFloat(form.fees) || 0

    if (form.linked_account_id) {
      const fromId = form.type === 'DEBIT' ? Number(form.account_id) : Number(form.linked_account_id)
      const toId   = form.type === 'CREDIT' ? Number(form.account_id) : Number(form.linked_account_id)
      await window.api.forecast.addTransfer({
        session_id:      session.id,
        from_account_id: fromId,
        to_account_id:   toId,
        amount,
        fees,
        date:        form.date,
        description: form.description || null,
      })
    } else {
      await window.api.forecast.addTransaction({
        session_id:  session.id,
        account_id:  Number(form.account_id),
        type:        form.type,
        amount,
        category_id: form.category_id ? Number(form.category_id) : null,
        date:        form.date,
        description: form.description || null,
      })
    }
    setForm(null)
    refetch()
  }

  const removeTx = async id => {
    await window.api.transactions.remove(id)
    refetch()
  }

  const validate = async () => {
    if (!confirm('Valider ? Les transactions deviennent reelles et irreversibles.')) return
    await window.api.forecast.validateSession(session.id)
    onChanged()
  }

  const txs = data?.transactions || []
  const net = txs.reduce((s, t) => s + (t.type === 'CREDIT' ? t.amount : -t.amount), 0)
  const isValidated = !!session.validated_at

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          Bilan net : {net >= 0 ? '+' : ''}{fmt(net)}
        </span>
        {!isValidated && txs.length > 0 && (
          <Button size="sm" variant="success" onClick={validate}>
            <CheckCircle size={12} />Valider (rendre reelles)
          </Button>
        )}
      </div>

      {loading ? <Spinner /> : txs.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-2">Aucune transaction dans cette simulation</p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {txs.map(tx => (
              <tr key={tx.id} className="border-b border-gray-800/40 group">
                <td className="py-1.5 text-gray-600">{fmtDate(tx.date)}</td>
                <td className="px-2 py-1.5 text-gray-300">
                  {tx.description || tx.category_name || '—'}
                </td>
                <td className="px-2 py-1.5">
                  <span className="text-gray-500">{tx.account_name}</span>
                </td>
                <td className={`py-1.5 text-right font-mono font-medium ${tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.type === 'CREDIT' ? '+' : '-'}{fmt(tx.amount)}
                </td>
                {!isValidated && (
                  <td className="py-1.5 pl-2">
                    <button
                      onClick={() => removeTx(tx.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-rose-400"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isValidated && (
        form ? (
          <div className="bg-gray-800/60 rounded-lg p-3 space-y-2 border border-gray-700">
            <div className="flex gap-2 flex-wrap">
              <select value={form.account_id} onChange={e => set('account_id', e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-xs focus:outline-none focus:border-blue-500">
                {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={form.type} onChange={e => { set('type', e.target.value); set('linked_account_id', '') }}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-xs focus:outline-none focus:border-blue-500">
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder="Montant"
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-xs focus:outline-none focus:border-blue-500 w-24" />
              {/* Source / Destination */}
              <select value={form.linked_account_id} onChange={e => set('linked_account_id', e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-xs focus:outline-none focus:border-blue-500">
                <option value="">{form.type === 'CREDIT' ? 'Source: Externe' : 'Dest: Externe'}</option>
                {(accounts || []).filter(a => String(a.id) !== String(form.account_id))
                  .map(a => <option key={a.id} value={a.id}>{form.type === 'CREDIT' ? 'De: ' : 'Vers: '}{a.name}</option>)}
              </select>
              {form.linked_account_id && (
                <input type="number" value={form.fees} onChange={e => set('fees', e.target.value)}
                  placeholder="Frais"
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-xs focus:outline-none focus:border-blue-500 w-20" />
              )}
              {!form.linked_account_id && (
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-xs focus:outline-none focus:border-blue-500">
                <option value="">Sans categorie</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              )}
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-xs focus:outline-none focus:border-blue-500"
              />
              <input
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Description"
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-xs focus:outline-none focus:border-blue-500 flex-1 min-w-24"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addTx} disabled={!form.amount || !form.account_id}>
                <Plus size={11} />Ajouter
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Annuler</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setForm(emptyTx(accounts))}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200 transition-colors py-1"
          >
            <Plus size={12} />
            Ajouter une transaction
          </button>
        )
      )}
    </div>
  )
}

export function ForecastModal({ isOpen, onClose, onSave, accounts, categories }) {
  const { data: sessions, loading, refetch } = useAsync(() => window.api.forecast.getSessions())
  const [expanded, setExpanded] = useState(null)

  const createSimulation = async () => {
    const n = (sessions?.length || 0) + 1
    const s = await window.api.forecast.createSession({
      name: `Simulation ${n}`,
      description: '',
    })
    await refetch()
    setExpanded(s.id)
    onSave()
  }

  const deleteSession = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Supprimer cette simulation et toutes ses transactions ?')) return
    await window.api.forecast.deleteSession(id)
    if (expanded === id) setExpanded(null)
    refetch()
    onSave()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Simulations" wide>
      <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
        {/* Bouton creation */}
        <button
          onClick={createSimulation}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-700 text-gray-500 hover:border-blue-500 hover:text-blue-400 transition-colors text-sm font-medium"
        >
          <GitBranch size={15} />
          Nouvelle route alternative
        </button>

        {/* Liste des simulations */}
        {loading ? <Spinner /> : (sessions || []).length === 0 ? (
          <p className="text-center text-gray-700 text-sm py-6">
            Aucune simulation — cree une route alternative pour voir ce qui se passerait
          </p>
        ) : (
          <div className="space-y-2">
            {(sessions || []).map((s, i) => (
              <div key={s.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700/50">
                <button
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-750 transition-colors"
                >
                  {expanded === s.id
                    ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                    : <ChevronRight size={14} className="text-gray-500 shrink-0" />
                  }
                  <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
                    {(sessions.length - i).toString()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200">{s.name}</p>
                    <p className="text-xs text-gray-600">
                      {fmtDate(s.created_at)} · {s.tx_count} transaction{s.tx_count !== 1 ? 's' : ''}
                      {s.validated_at ? ' · Validee' : ''}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${s.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {s.net >= 0 ? '+' : ''}{fmt(s.net)}
                  </span>
                  {s.validated_at
                    ? <Badge color="#10B981">Validee</Badge>
                    : (
                      <button
                        onClick={e => deleteSession(e, s.id)}
                        className="p-1.5 text-gray-700 hover:text-rose-400 ml-1 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )
                  }
                </button>

                {expanded === s.id && (
                  <div className="px-4 pb-4 border-t border-gray-700/50">
                    <SessionDetail
                      session={s}
                      accounts={accounts}
                      categories={categories}
                      onChanged={() => { refetch(); onSave() }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
