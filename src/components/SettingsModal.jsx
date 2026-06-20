import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input, Select } from './ui/Field'
import { Spinner } from './ui/Spinner'
import { useAsync } from '../hooks/useAsync'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316','#6B7280','#84CC16']
const emptyForm = { name: '', flow: 'DEBIT', color: '#3B82F6' }

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {COLORS.map(c => (
        <button
          key={c} type="button"
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full border transition-all ${value === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

function CategoryRow({ cat, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: cat.name, flow: cat.flow, color: cat.color || '#6B7280' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    await window.api.categories.update({ id: cat.id, ...form })
    setEditing(false)
    onSaved()
  }
  const remove = async () => {
    if (!confirm(`Supprimer "${cat.name}" ?`)) return
    await window.api.categories.remove(cat.id)
    onDeleted()
  }

  if (!editing) {
    return (
      <tr className="group border-b border-gray-800/50">
        <td className="py-2">
          <span className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6B7280' }} />
            <span className="text-sm text-gray-200">{cat.name}</span>
          </span>
        </td>
        <td className="px-3 py-2">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            cat.flow === 'DEBIT' ? 'bg-rose-900/40 text-rose-400' :
            cat.flow === 'CREDIT' ? 'bg-emerald-900/40 text-emerald-400' :
            'bg-gray-700 text-gray-400'
          }`}>{cat.flow}</span>
        </td>
        <td className="py-2 text-right">
          <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)} className="p-1 text-gray-500 hover:text-gray-200">
              <Pencil size={11} />
            </button>
            <button onClick={remove} className="p-1 text-gray-500 hover:text-rose-400">
              <Trash2 size={11} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-800/50 bg-gray-800/50">
      <td className="py-2 pr-2">
        <div className="space-y-1">
          <Input value={form.name} onChange={e => set('name', e.target.value)} className="text-xs w-full" />
          <ColorPicker value={form.color} onChange={v => set('color', v)} />
        </div>
      </td>
      <td className="px-3 py-2">
        <Select value={form.flow} onChange={e => set('flow', e.target.value)} className="text-xs w-24">
          <option value="DEBIT">DEBIT</option>
          <option value="CREDIT">CREDIT</option>
          <option value="BOTH">BOTH</option>
        </Select>
      </td>
      <td className="py-2 text-right">
        <div className="inline-flex items-center gap-1">
          <button onClick={save} disabled={!form.name} className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40">
            <Check size={12} />
          </button>
          <button onClick={() => setEditing(false)} className="p-1 text-gray-500 hover:text-gray-200">
            <X size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function NewCategoryForm({ onCreated }) {
  const [form, setForm] = useState(emptyForm)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const save = async () => {
    if (!form.name) return
    await window.api.categories.create(form)
    setForm(emptyForm)
    onCreated()
  }
  return (
    <div className="border border-dashed border-gray-700 rounded-lg p-3 space-y-2 mt-3">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nouvelle categorie</p>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-28">
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nom" className="text-xs" />
        </div>
        <Select value={form.flow} onChange={e => set('flow', e.target.value)} className="text-xs w-24">
          <option value="DEBIT">DEBIT</option>
          <option value="CREDIT">CREDIT</option>
          <option value="BOTH">BOTH</option>
        </Select>
        <Button size="sm" onClick={save} disabled={!form.name}><Plus size={11} />Ajouter</Button>
      </div>
      <ColorPicker value={form.color} onChange={v => set('color', v)} />
    </div>
  )
}

export function SettingsModal({ isOpen, onClose, onSave }) {
  const { data: categories, loading, refetch } = useAsync(() => window.api.categories.getAll())

  const refresh = () => { refetch(); onSave?.() }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Categories de transactions">
      <div className="max-h-[65vh] overflow-y-auto">
        {loading ? <Spinner /> : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-xs text-gray-500 pb-2 font-medium">Nom</th>
                <th className="text-left text-xs text-gray-500 pb-2 font-medium px-3">Flux</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(categories || []).map(cat => (
                <CategoryRow key={cat.id} cat={cat} onSaved={refresh} onDeleted={refresh} />
              ))}
            </tbody>
          </table>
        )}
        <NewCategoryForm onCreated={refresh} />
      </div>
    </Modal>
  )
}
