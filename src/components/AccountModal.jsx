import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input, Select } from './ui/Field'

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316','#6B7280','#84CC16']
const empty  = { name: '', type: 'ELECTRONIC', provider: '', initial_balance: '', currency: 'FCFA', color: '#3B82F6' }

export function AccountModal({ isOpen, onClose, onSave, account }) {
  const [form, setForm] = useState(empty)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (isOpen) setForm(account ? { ...account, initial_balance: account.initial_balance } : empty)
  }, [isOpen])

  const save = async () => {
    const data = { ...form, initial_balance: parseFloat(form.initial_balance) || 0 }
    if (account?.id) await window.api.accounts.update({ id: account.id, ...data })
    else             await window.api.accounts.create(data)
    onSave()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={account ? 'Modifier le compte' : 'Nouveau compte'}>
      <div className="space-y-4">
        <Field label="Nom">
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Mon compte Orabank" />
        </Field>

        <Field label="Type">
          <Select value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="ELECTRONIC">Monnaie electronique</option>
            <option value="PHYSICAL">Monnaie physique (cash)</option>
          </Select>
        </Field>

        {form.type === 'ELECTRONIC' && (
          <Field label="Operateur / Banque">
            <Input value={form.provider} onChange={e => set('provider', e.target.value)} placeholder="Orabank, Tmoney..." />
          </Field>
        )}

        <Field label="Solde initial (FCFA)">
          <Input type="number" value={form.initial_balance} onChange={e => set('initial_balance', e.target.value)} placeholder="0" />
        </Field>

        <Field label="Couleur">
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c} type="button"
                onClick={() => set('color', c)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
          <Button onClick={save} disabled={!form.name} className="flex-1">Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}
