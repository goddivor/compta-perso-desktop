import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { Spinner } from '../ui/Spinner'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Field, Input, Select } from '../ui/Field'
import { Badge } from '../ui/Badge'
import { Plus, Edit2, Trash2 } from 'lucide-react'

const COLORS = ['#F59E0B','#EF4444','#10B981','#3B82F6','#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316','#6B7280','#94A3B8']
const empty  = { name: '', flow: 'DEBIT', color: '#6B7280', icon: '📦' }

function CategoryModal({ isOpen, onClose, onSave, cat }) {
  const [form, setForm] = useState(cat || empty)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (cat?.id) await window.api.categories.update({ id: cat.id, ...form })
    else         await window.api.categories.create(form)
    onSave()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cat ? 'Modifier la catégorie' : 'Nouvelle catégorie'}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Icône" className="col-span-1">
            <Input value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="🏷️" className="text-xl text-center" />
          </Field>
          <div className="col-span-2">
            <Field label="Nom">
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nourriture…" />
            </Field>
          </div>
        </div>

        <Field label="Sens">
          <Select value={form.flow} onChange={e => set('flow', e.target.value)}>
            <option value="DEBIT">Débit (dépense)</option>
            <option value="CREDIT">Crédit (entrée)</option>
            <option value="BOTH">Les deux</option>
          </Select>
        </Field>

        <Field label="Couleur">
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => set('color', c)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={!form.name}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}

const flowLabel = { DEBIT: 'Débit', CREDIT: 'Crédit', BOTH: 'Les deux' }
const flowColor = { DEBIT: '#EF4444', CREDIT: '#10B981', BOTH: '#6B7280' }

export function Settings() {
  const { data: categories, loading, refetch } = useAsync(() => window.api.categories.getAll())
  const [modal, setModal] = useState(null)

  const remove = async (id) => {
    if (!confirm('Supprimer cette catégorie ?')) return
    await window.api.categories.remove(id)
    refetch()
  }

  if (loading) return <Spinner />

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Paramètres — Catégories</h1>
        <Button onClick={() => setModal('new')}><Plus size={14} />Nouvelle catégorie</Button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
              <th className="px-5 py-3 text-left">Icône</th>
              <th className="px-3 py-3 text-left">Nom</th>
              <th className="px-3 py-3 text-left">Sens</th>
              <th className="px-5 py-3 text-left">Couleur</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {(categories || []).map(c => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 group">
                <td className="px-5 py-3 text-xl">{c.icon}</td>
                <td className="px-3 py-3 text-gray-200 font-medium">{c.name}</td>
                <td className="px-3 py-3">
                  <Badge color={flowColor[c.flow]}>{flowLabel[c.flow]}</Badge>
                </td>
                <td className="px-5 py-3">
                  <span className="w-5 h-5 rounded-full inline-block border border-gray-700" style={{ backgroundColor: c.color }} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <button onClick={() => setModal(c)} className="p-1.5 rounded text-gray-500 hover:text-gray-100 hover:bg-gray-700">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => remove(c.id)} className="p-1.5 rounded text-gray-500 hover:text-rose-400 hover:bg-gray-700">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <CategoryModal
          isOpen
          cat={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={refetch}
        />
      )}
    </div>
  )
}
