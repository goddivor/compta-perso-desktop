import { useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'
import { fmt, fmtDate, today } from '../utils/format'
import { Input, Select } from './ui/Field'
import { Plus, ChevronRight, ChevronDown, CheckCircle, Trash2, GitBranch, Pencil, TrendingUp, TrendingDown } from 'lucide-react'

const emptyTx = (accounts, defaultAccountId) => ({
  account_id:        defaultAccountId || accounts?.[0]?.id || '',
  type:              'DEBIT',
  amount:            '',
  category_id:       '',
  date:              today(),
  description:       '',
  linked_account_id: '',
  fees:              '',
})

function TxForm({ form, set, accounts, categories, onSave, onCancel }) {
  const filteredCats = (categories || []).filter(
    c => c.flow === 'BOTH' || c.flow === form.type
  )
  const isTransfer = !!form.linked_account_id
  const otherAccounts = (accounts || []).filter(a => String(a.id) !== String(form.account_id))

  return (
    <div className="bg-surface rounded-xl border border-edge p-4 space-y-3 mt-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider">
        {form._id ? 'Modifier la transaction' : 'Nouvelle transaction'}
      </p>

      {/* Ligne 1 : Compte + Source/Dest */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted mb-1">Compte</label>
          <Select value={form.account_id} onChange={e => set('account_id', e.target.value)}>
            {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        {!form._id ? (
          <div>
            <label className="block text-xs text-muted mb-1">
              {form.type === 'CREDIT' ? 'Source' : 'Destination'}
            </label>
            <Select value={form.linked_account_id} onChange={e => set('linked_account_id', e.target.value)}>
              <option value="">Externe</option>
              {otherAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
        ) : <div />}
      </div>

      {/* Ligne 2 : Type + Montant + Frais/Categorie */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-muted mb-1">Type</label>
          <Select value={form.type} onChange={e => { set('type', e.target.value); set('linked_account_id', '') }}>
            <option value="DEBIT">Debit</option>
            <option value="CREDIT">Credit</option>
          </Select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Montant (FCFA)</label>
          <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" min="0" />
        </div>
        <div>
          {isTransfer ? (
            <>
              <label className="block text-xs text-muted mb-1">Frais</label>
              <Input type="number" value={form.fees} onChange={e => set('fees', e.target.value)} placeholder="0" min="0" />
            </>
          ) : (
            <>
              <label className="block text-xs text-muted mb-1">Categorie</label>
              <Select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">Sans categorie</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </>
          )}
        </div>
      </div>

      {/* Ligne 3 : Date + Description */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-muted mb-1">Date</label>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Description</label>
          <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optionnel..." />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} disabled={!form.amount || !form.account_id} className="flex-1">
          {!form._id && <Plus size={13} />}
          {form._id ? 'Sauvegarder' : 'Ajouter'}
        </Button>
        <Button variant="secondary" onClick={onCancel} className="flex-1">Annuler</Button>
      </div>
    </div>
  )
}

function SessionDetail({ session, accounts, categories, defaultAccountId, onChanged }) {
  const { data, loading, refetch } = useAsync(
    () => window.api.forecast.getSession(session.id), [session.id]
  )
  const [form, setForm] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveTx = async () => {
    if (!form?.amount || !form?.account_id) return
    const amount = parseFloat(form.amount)
    const fees   = parseFloat(form.fees) || 0

    if (form._id) {
      await window.api.transactions.update({
        id: form._id, account_id: Number(form.account_id), type: form.type,
        amount, category_id: form.category_id ? Number(form.category_id) : null,
        date: form.date, description: form.description || null,
      })
    } else if (form.linked_account_id) {
      const fromId = form.type === 'DEBIT' ? Number(form.account_id) : Number(form.linked_account_id)
      const toId   = form.type === 'CREDIT' ? Number(form.account_id) : Number(form.linked_account_id)
      await window.api.forecast.addTransfer({
        session_id: session.id, from_account_id: fromId, to_account_id: toId,
        amount, fees, date: form.date, description: form.description || null,
      })
    } else {
      await window.api.forecast.addTransaction({
        session_id: session.id, account_id: Number(form.account_id), type: form.type,
        amount, category_id: form.category_id ? Number(form.category_id) : null,
        date: form.date, description: form.description || null,
      })
    }
    setForm(null)
    refetch()
  }

  const editTx = tx => setForm({
    _id: tx.id, account_id: tx.account_id, type: tx.type, amount: tx.amount,
    category_id: tx.category_id || '', date: (tx.date || today()).slice(0, 10),
    description: tx.description || '', linked_account_id: '', fees: '',
  })

  const removeTx = async id => { await window.api.transactions.remove(id); refetch() }

  const validate = async () => {
    if (!confirm('Valider ? Les transactions deviennent reelles et irreversibles.')) return
    await window.api.forecast.validateSession(session.id)
    onChanged()
  }

  const txs = data?.transactions || []
  const net = txs.reduce((s, t) => s + (t.type === 'CREDIT' ? t.amount : -t.amount), 0)
  const isValidated = !!session.validated_at

  return (
    <div className="mt-3 space-y-3">
      {/* Bilan + Valider */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {net >= 0
            ? <TrendingUp size={15} className="text-emerald-400" />
            : <TrendingDown size={15} className="text-rose-400" />}
          <span className={`text-sm font-bold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {net >= 0 ? '+' : ''}{fmt(net)} FCFA
          </span>
        </div>
        {!isValidated && txs.length > 0 && (
          <Button size="sm" variant="success" onClick={validate}>
            <CheckCircle size={12} />Valider
          </Button>
        )}
      </div>

      {/* Liste des transactions */}
      {loading ? <Spinner /> : txs.length === 0 ? (
        <p className="text-xs text-faint text-center py-3 border border-dashed border-edge rounded-lg">
          Aucune transaction — ajoute-en une ci-dessous
        </p>
      ) : (
        <div className="space-y-1">
          {txs.map(tx => (
            <div key={tx.id} className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface2/50 transition-colors">
              <div className={`w-1.5 h-8 rounded-full shrink-0 ${tx.type === 'CREDIT' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-content truncate">{tx.description || tx.category_name || '—'}</p>
                <p className="text-xs text-faint">{fmtDate(tx.date)} · {tx.account_name}</p>
              </div>
              <span className={`text-sm font-mono font-semibold shrink-0 ${tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {tx.type === 'CREDIT' ? '+' : '-'}{fmt(tx.amount)}
              </span>
              {!isValidated && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => editTx(tx)} className="p-1.5 text-faint hover:text-primary rounded transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => removeTx(tx.id)} className="p-1.5 text-faint hover:text-rose-400 rounded transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formulaire ajout/edition */}
      {!isValidated && (
        form
          ? <TxForm form={form} set={set} accounts={accounts} categories={categories} onSave={saveTx} onCancel={() => setForm(null)} />
          : (
            <button
              onClick={() => setForm(emptyTx(accounts, defaultAccountId))}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-edge text-muted hover:border-primary hover:text-primary transition-colors text-sm"
            >
              <Plus size={14} />Ajouter une transaction
            </button>
          )
      )}
    </div>
  )
}

export function ForecastModal({ isOpen, onClose, onSave, accounts, categories, defaultAccountId }) {
  const { data: sessions, loading, refetch } = useAsync(() => window.api.forecast.getSessions())
  const [expanded, setExpanded] = useState(null)

  const createSimulation = async () => {
    const n = (sessions?.length || 0) + 1
    const s = await window.api.forecast.createSession({ name: `Simulation ${n}`, description: '' })
    await refetch()
    setExpanded(s.id)
    onSave()
  }

  const deleteSession = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Supprimer cette simulation et toutes ses transactions ?')) return
    await window.api.forecast.deleteSession(id)
    if (expanded === id) setExpanded(null)
    refetch(); onSave()
  }

  const SIM_COLORS = ['#F59E0B','#818CF8','#34D399','#F472B6','#60A5FA','#FB923C']

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Simulations" wide>
      <div className="space-y-3 max-h-[78vh] overflow-y-auto pr-1">

        {/* Bouton creation */}
        <button
          onClick={createSimulation}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 hover:border-primary transition-all text-sm font-medium"
        >
          <GitBranch size={15} />
          Nouvelle simulation
        </button>

        {/* Liste */}
        {loading ? <Spinner /> : (sessions || []).length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <GitBranch size={28} className="mx-auto text-faint" />
            <p className="text-faint text-sm">Aucune simulation pour l'instant</p>
            <p className="text-faint text-xs">Cree une simulation pour explorer des scenarios alternatifs</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(sessions || []).map((s, i) => {
              const color = SIM_COLORS[i % SIM_COLORS.length]
              const isOpen = expanded === s.id
              return (
                <div key={s.id} className="rounded-xl overflow-hidden border border-edge/60"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
                  {/* En-tête session */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left bg-surface2/50 hover:bg-surface2 transition-colors"
                  >
                    {isOpen
                      ? <ChevronDown size={14} className="text-muted shrink-0" />
                      : <ChevronRight size={14} className="text-muted shrink-0" />}
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: color + '22', color }}>
                      {sessions.length - i}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-muted">
                        {fmtDate(s.created_at)} · {s.tx_count} transaction{s.tx_count !== 1 ? 's' : ''}
                        {s.validated_at ? ' · Validee' : ''}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${s.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {s.net >= 0 ? '+' : ''}{fmt(s.net)}
                    </span>
                    {s.validated_at ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 font-medium ml-1">
                        Validee
                      </span>
                    ) : (
                      <button onClick={e => deleteSession(e, s.id)}
                        className="p-1.5 text-faint hover:text-rose-400 ml-1 transition-colors rounded">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </button>

                  {/* Detail session */}
                  {isOpen && (
                    <div className="px-4 pb-4 bg-surface2/20 border-t border-edge/40">
                      <SessionDetail
                        session={s}
                        accounts={accounts}
                        categories={categories}
                        defaultAccountId={defaultAccountId}
                        onChanged={() => { refetch(); onSave() }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
