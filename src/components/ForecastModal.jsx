import { useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input, Select, Textarea } from './ui/Field'
import { Badge } from './ui/Badge'
import { Spinner } from './ui/Spinner'
import { fmt, fmtDate, today } from '../utils/format'
import { Plus, ChevronRight, ChevronDown, CheckCircle, Trash2 } from 'lucide-react'

function NewSessionForm({ onCreated }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const save = async () => {
    await window.api.forecast.createSession(form)
    setForm({ name: '', description: '' })
    onCreated()
  }
  return (
    <div className="border border-dashed border-gray-700 rounded-lg p-4 space-y-3">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nouvelle simulation</p>
      <Field label="Nom">
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Courses du mois" />
      </Field>
      <Textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description (optionnel)" />
      <Button size="sm" onClick={save} disabled={!form.name}><Plus size={12} />Creer</Button>
    </div>
  )
}

function SessionDetail({ session, accounts, categories, onChanged }) {
  const { data, loading, refetch } = useAsync(() => window.api.forecast.getSession(session.id), [session.id])
  const [form, setForm] = useState({ account_id: accounts?.[0]?.id || '', type: 'DEBIT', amount: '', category_id: '', date: today(), description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const filteredCats = (categories || []).filter(c => c.flow === 'BOTH' || c.flow === form.type)

  const addTx = async () => {
    if (!form.amount || !form.account_id) return
    await window.api.forecast.addTransaction({
      session_id:  session.id,
      account_id:  Number(form.account_id),
      type:        form.type,
      amount:      parseFloat(form.amount),
      category_id: form.category_id ? Number(form.category_id) : null,
      date:        form.date,
      description: form.description || null,
    })
    setForm(f => ({ ...f, amount: '', description: '', category_id: '' }))
    refetch()
  }

  const removeTx = async id => {
    await window.api.transactions.remove(id)
    refetch()
  }

  const validate = async () => {
    if (!confirm('Valider ? Les transactions deviennent reelles.')) return
    await window.api.forecast.validateSession(session.id)
    onChanged()
  }

  const net = (data?.transactions || []).reduce((s, t) => s + (t.type === 'CREDIT' ? t.amount : -t.amount), 0)
  const isValidated = !!session.validated_at

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          Bilan : {net >= 0 ? '+' : ''}{fmt(net)}
        </span>
        {!isValidated && (
          <Button size="sm" variant="success" onClick={validate}>
            <CheckCircle size={12} />Valider
          </Button>
        )}
      </div>

      {loading ? <Spinner /> : (
        <table className="w-full text-xs">
          <tbody>
            {(data?.transactions || []).map(tx => (
              <tr key={tx.id} className="border-b border-gray-800/50 group">
                <td className="py-1.5 text-gray-500">{fmtDate(tx.date)}</td>
                <td className="px-2 py-1.5 text-gray-300">{tx.description || tx.category_name || '—'}</td>
                <td className="px-2 py-1.5 text-gray-500">{tx.account_name}</td>
                <td className={`py-1.5 text-right font-mono ${tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.type === 'CREDIT' ? '+' : '-'}{fmt(tx.amount)}
                </td>
                {!isValidated && (
                  <td className="py-1.5 pl-2">
                    <button onClick={() => removeTx(tx.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-rose-400">
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
        <div className="flex flex-wrap gap-2 items-end pt-1 border-t border-gray-800">
          <Select value={form.account_id} onChange={e => set('account_id', e.target.value)} className="w-28 text-xs">
            {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select value={form.type} onChange={e => set('type', e.target.value)} className="w-24 text-xs">
            <option value="DEBIT">Debit</option>
            <option value="CREDIT">Credit</option>
          </Select>
          <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="Montant" className="w-24 text-xs" />
          <Select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="w-28 text-xs">
            <option value="">Categorie</option>
            {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="w-32 text-xs" />
          <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description" className="w-32 text-xs" />
          <Button size="sm" onClick={addTx} disabled={!form.amount}><Plus size={11} />Ajouter</Button>
        </div>
      )}
    </div>
  )
}

export function ForecastModal({ isOpen, onClose, onSave, accounts, categories }) {
  const { data: sessions, loading, refetch } = useAsync(() => window.api.forecast.getSessions())
  const [expanded, setExpanded] = useState(null)

  const deleteSession = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Supprimer cette simulation ?')) return
    await window.api.forecast.deleteSession(id)
    refetch()
    onSave()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Simulations previsionnelles" wide>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <NewSessionForm onCreated={() => { refetch(); onSave() }} />

        {loading ? <Spinner /> : (sessions || []).length === 0 ? (
          <p className="text-center text-gray-600 text-sm py-4">Aucune simulation cree</p>
        ) : (
          <div className="space-y-2">
            {(sessions || []).map(s => (
              <div key={s.id} className="bg-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-750 transition-colors"
                >
                  {expanded === s.id ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">{fmtDate(s.created_at)} · {s.tx_count} tx{s.validated_at ? ' · Validee' : ''}</p>
                  </div>
                  <span className={`text-sm font-medium shrink-0 ${s.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {s.net >= 0 ? '+' : ''}{fmt(s.net)}
                  </span>
                  {s.validated_at && <Badge color="#10B981">Validee</Badge>}
                  {!s.validated_at && (
                    <button onClick={(e) => deleteSession(e, s.id)} className="p-1 text-gray-600 hover:text-rose-400 ml-1">
                      <Trash2 size={12} />
                    </button>
                  )}
                </button>
                {expanded === s.id && (
                  <div className="px-4 pb-4 border-t border-gray-700">
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
