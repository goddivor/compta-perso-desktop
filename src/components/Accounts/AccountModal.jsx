import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Select } from '../ui/Field'

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316','#6B7280']

const empty = { name: '', type: 'ELECTRONIC', provider: '', initial_balance: '', currency: 'FCFA', color: '#3B82F6' }

export function AccountModal({ isOpen, onClose, onSave, account }) {
  const [form, setForm] = useState(account || empty)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const data = { ...form, initial_balance: parseFloat(form.initial_balance) || 0 }
    if (account?.id) {
      await window.api.accounts.update({ id: account.id, ...data })
    } else {
      await window.api.accounts.create(data)
    }
    onSave()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={account ? 'Modifier le compte' : 'Nouveau compte'}>
      <div className="space-y-4">
        <Field label="Nom du compte">
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Mon compte Orabank" />
        </Field>

        <Field label="Type">
          <Select value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="ELECTRONIC">Monnaie électronique</option>
            <option value="PHYSICAL">Monnaie physique (cash)</option>
          </Select>
        </Field>

        {form.type === 'ELECTRONIC' && (
          <Field label="Opérateur / Banque">
            <Input value={form.provider} onChange={e => set('provider', e.target.value)} placeholder="Ex: Orabank, Tmoney…" />
          </Field>
        )}

        <Field label="Solde initial">
          <Input type="number" value={form.initial_balance} onChange={e => set('initial_balance', e.target.value)} placeholder="0" />
        </Field>

        <Field label="Couleur">
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
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
