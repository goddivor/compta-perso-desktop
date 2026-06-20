import { useState, useCallback } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { fmt, fmtDate } from '../../utils/format'
import { Spinner } from '../ui/Spinner'
import { Button } from '../ui/Button'
import { Badge, TypeBadge } from '../ui/Badge'
import { Select, Input } from '../ui/Field'
import { TransactionModal } from './TransactionModal'
import { TransferModal } from './TransferModal'
import { Plus, ArrowLeftRight, Edit2, Trash2, Filter } from 'lucide-react'

export function Transactions() {
  const [filters, setFilters] = useState({ account_id: '', type: '', date_from: '', date_to: '', category_id: '' })
  const [modal, setModal]     = useState(null) // null | 'new' | 'transfer' | tx object
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  const { data: txs,   loading, refetch }  = useAsync(
    () => window.api.transactions.getAll({
      account_id:  filters.account_id  || undefined,
      type:        filters.type        || undefined,
      date_from:   filters.date_from   || undefined,
      date_to:     filters.date_to     || undefined,
      category_id: filters.category_id || undefined,
    }),
    [filters]
  )
  const { data: accounts }   = useAsync(() => window.api.accounts.getAll())
  const { data: categories } = useAsync(() => window.api.categories.getAll())

  const remove = async (id) => {
    if (!confirm('Supprimer cette transaction ?')) return
    await window.api.transactions.remove(id)
    refetch()
  }

  const handleSave = () => refetch()

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Transactions</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setModal('transfer')}><ArrowLeftRight size={14} />Retrait</Button>
          <Button onClick={() => setModal('new')}><Plus size={14} />Nouvelle</Button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-wrap gap-3 items-end">
        <Filter size={14} className="text-gray-500 mt-auto mb-1" />

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Compte</label>
          <Select value={filters.account_id} onChange={e => setF('account_id', e.target.value)} className="w-40">
            <option value="">Tous</option>
            {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Type</label>
          <Select value={filters.type} onChange={e => setF('type', e.target.value)} className="w-32">
            <option value="">Tous</option>
            <option value="CREDIT">Crédit</option>
            <option value="DEBIT">Débit</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Catégorie</label>
          <Select value={filters.category_id} onChange={e => setF('category_id', e.target.value)} className="w-36">
            <option value="">Toutes</option>
            {(categories || []).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Du</label>
          <Input type="date" value={filters.date_from} onChange={e => setF('date_from', e.target.value)} className="w-36" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Au</label>
          <Input type="date" value={filters.date_to} onChange={e => setF('date_to', e.target.value)} className="w-36" />
        </div>

        <Button variant="ghost" size="sm" onClick={() => setFilters({ account_id:'',type:'',date_from:'',date_to:'',category_id:'' })}>
          Réinitialiser
        </Button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Description</th>
                <th className="px-3 py-3 text-left">Compte</th>
                <th className="px-3 py-3 text-left">Catégorie</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-right">Montant</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {(txs || []).length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-500 py-10">Aucune transaction</td></tr>
              ) : (txs || []).map(tx => (
                <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors group">
                  <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{fmtDate(tx.date)}</td>
                  <td className="px-3 py-3 text-gray-300 max-w-[160px] truncate">{tx.description || '—'}</td>
                  <td className="px-3 py-3 text-gray-400 text-xs">{tx.account_name}</td>
                  <td className="px-3 py-3">
                    {tx.category_name
                      ? <Badge color={tx.category_color}>{tx.category_icon} {tx.category_name}</Badge>
                      : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-3"><TypeBadge type={tx.type} /></td>
                  <td className={`px-5 py-3 text-right font-medium ${tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      {!tx.transfer_pair_id && (
                        <button onClick={() => setModal(tx)} className="p-1.5 rounded text-gray-500 hover:text-gray-100 hover:bg-gray-700 transition-colors">
                          <Edit2 size={13} />
                        </button>
                      )}
                      <button onClick={() => remove(tx.id)} className="p-1.5 rounded text-gray-500 hover:text-rose-400 hover:bg-gray-700 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && modal !== 'transfer' && (
        <TransactionModal
          isOpen
          transaction={modal === 'new' ? null : modal}
          accounts={accounts || []}
          categories={categories || []}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {modal === 'transfer' && (
        <TransferModal
          isOpen
          accounts={accounts || []}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
