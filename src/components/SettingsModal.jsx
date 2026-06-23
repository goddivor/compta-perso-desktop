import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Field'
import { Spinner } from './ui/Spinner'
import { useAsync } from '../hooks/useAsync'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316','#6B7280','#84CC16']
const emptyForm = { name: '', flow: 'DEBIT', color: '#3B82F6' }

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {COLORS.map(c => (
        <button
          key={c} type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full border-2 transition-all ${value === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

function CategoryCard({ cat, onSaved, onDeleted }) {
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

  if (editing) {
    return (
      <div className="bg-gray-800 rounded-xl p-3 border border-blue-500/40 space-y-2 col-span-1">
        <Input value={form.name} onChange={e => set('name', e.target.value)} className="text-xs w-full" />
        <Select value={form.flow} onChange={e => set('flow', e.target.value)} className="text-xs w-full">
          <option value="DEBIT">DEBIT</option>
          <option value="CREDIT">CREDIT</option>
          <option value="BOTH">BOTH</option>
        </Select>
        <ColorPicker value={form.color} onChange={v => set('color', v)} />
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={!form.name}
            className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-40 transition-colors">
            <Check size={12} className="mr-1" />Sauvegarder
          </button>
          <button onClick={() => setEditing(false)}
            className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-medium bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
            <X size={12} className="mr-1" />Annuler
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group bg-gray-800/60 hover:bg-gray-800 rounded-xl p-3 border border-edge/40 hover:border-edge transition-all flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6B7280' }} />
        <span className="text-sm text-gray-200 font-medium truncate">{cat.name}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          cat.flow === 'DEBIT'  ? 'bg-rose-900/40 text-rose-400' :
          cat.flow === 'CREDIT' ? 'bg-emerald-900/40 text-emerald-400' :
          'bg-gray-700 text-gray-400'
        }`}>{cat.flow}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1 text-gray-500 hover:text-blue-400 transition-colors">
            <Pencil size={12} />
          </button>
          <button onClick={remove} className="p-1 text-gray-500 hover:text-rose-400 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function SettingsModal({ isOpen, onClose, onSave }) {
  const { data: categories, loading, refetch } = useAsync(() => window.api.categories.getAll())
  const [form, setForm] = useState(emptyForm)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const refresh = () => { refetch(); onSave?.() }

  const addCategory = async () => {
    if (!form.name) return
    await window.api.categories.create({ ...form, icon: '' })
    setForm(emptyForm)
    refresh()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Categories de transactions" wide="xl">
      <div className="flex gap-6">
        {/* Panneau gauche : grille des catégories */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Categorie existantes</p>
          {loading ? <Spinner /> : (
            <div className="grid grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto pr-1">
              {(categories || []).map(cat => (
                <CategoryCard key={cat.id} cat={cat} onSaved={refresh} onDeleted={refresh} />
              ))}
            </div>
          )}
        </div>

        {/* Séparateur */}
        <div className="w-px bg-gray-800 self-stretch" />

        {/* Panneau droit : formulaire nouvelle catégorie */}
        <div className="w-56 shrink-0 space-y-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nouvelle categorie</p>
          <Input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Nom"
            className="text-xs w-full"
          />
          <Select value={form.flow} onChange={e => set('flow', e.target.value)} className="text-xs w-full">
            <option value="DEBIT">DEBIT</option>
            <option value="CREDIT">CREDIT</option>
            <option value="BOTH">BOTH</option>
          </Select>
          <div>
            <p className="text-xs text-gray-600 mb-2">Couleur</p>
            <ColorPicker value={form.color} onChange={v => set('color', v)} />
          </div>
          {/* Apercu */}
          {form.name && (
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: form.color }} />
              <span className="text-sm text-gray-200 truncate">{form.name}</span>
              <span className={`ml-auto text-xs px-1.5 py-0.5 rounded font-medium ${
                form.flow === 'DEBIT'  ? 'bg-rose-900/40 text-rose-400' :
                form.flow === 'CREDIT' ? 'bg-emerald-900/40 text-emerald-400' :
                'bg-gray-700 text-gray-400'
              }`}>{form.flow}</span>
            </div>
          )}
          <Button onClick={addCategory} disabled={!form.name} className="w-full">
            <Plus size={13} />Ajouter
          </Button>
        </div>
      </div>
    </Modal>
  )
}
