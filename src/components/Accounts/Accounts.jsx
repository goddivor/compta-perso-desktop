import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { fmt } from '../../utils/format'
import { Spinner, Empty } from '../ui/Spinner'
import { Button } from '../ui/Button'
import { AccountModal } from './AccountModal'
import { Plus, Edit2, Trash2, CreditCard, Wallet } from 'lucide-react'

export function Accounts() {
  const { data: summary, loading, refetch } = useAsync(() => window.api.stats.getSummary())
  const [modal, setModal] = useState(null) // null | 'new' | account object

  const remove = async (id) => {
    if (!confirm('Supprimer ce compte et toutes ses transactions ?')) return
    await window.api.accounts.remove(id)
    refetch()
  }

  if (loading) return <Spinner />

  const accounts = summary?.accounts || []
  const electronic = accounts.filter(a => a.type === 'ELECTRONIC')
  const physical   = accounts.filter(a => a.type === 'PHYSICAL')

  const Section = ({ title, icon: Icon, items, emptyLabel }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon size={15} />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-dashed border-gray-700 p-6 text-center text-gray-500 text-sm">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map(a => (
            <div key={a.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5 group relative">
              <div className="flex items-start justify-between mb-3">
                <span className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: a.color }} />
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setModal(a)} className="p-1.5 rounded text-gray-500 hover:text-gray-100 hover:bg-gray-800 transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => remove(a.id)} className="p-1.5 rounded text-gray-500 hover:text-rose-400 hover:bg-gray-800 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="font-semibold text-gray-100 mb-0.5">{a.name}</p>
              {a.provider && <p className="text-xs text-gray-500 mb-3">{a.provider}</p>}
              <p className={`text-2xl font-bold ${a.current_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmt(a.current_balance)}
              </p>
              <p className="text-xs text-gray-600 mt-1">Solde initial : {fmt(a.initial_balance)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Comptes</h1>
        <Button onClick={() => setModal('new')}><Plus size={15} />Nouveau compte</Button>
      </div>

      <Section title="Monnaie électronique" icon={CreditCard} items={electronic} emptyLabel="Aucun compte électronique" />
      <Section title="Monnaie physique" icon={Wallet} items={physical} emptyLabel="Aucun compte cash" />

      {modal && (
        <AccountModal
          isOpen
          account={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={refetch}
        />
      )}
    </div>
  )
}
