import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Select } from '../ui/Field'
import { today } from '../../utils/format'

export function TransferModal({ isOpen, onClose, onSave, accounts }) {
  const [form, setForm] = useState({ from_account_id: '', to_account_id: '', amount: '', fees: '', date: today(), description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (isOpen) {
      const elec = accounts?.filter(a => a.type === 'ELECTRONIC') || []
      const phys = accounts?.filter(a => a.type === 'PHYSICAL') || []
      setForm(f => ({
        ...f,
        from_account_id: elec[0]?.id || '',
        to_account_id: phys[0]?.id || '',
        amount: '', fees: '', date: today(), description: ''
      }))
    }
  }, [isOpen])

  const handleSave = async () => {
    await window.api.transfers.create({
      from_account_id: Number(form.from_account_id),
      to_account_id:   Number(form.to_account_id),
      amount:  parseFloat(form.amount),
      fees:    parseFloat(form.fees) || 0,
      date:    form.date,
      description: form.description || null,
    })
    onSave()
    onClose()
  }

  const valid = form.from_account_id && form.to_account_id && form.amount && form.from_account_id !== form.to_account_id

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Retrait / Virement">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">Débite un compte électronique et crédite un compte physique (ou l'inverse).</p>

        <Field label="Compte source (débit)">
          <Select value={form.from_account_id} onChange={e => set('from_account_id', e.target.value)}>
            <option value="">— Choisir —</option>
            {(accounts || []).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Compte destination (crédit)">
          <Select value={form.to_account_id} onChange={e => set('to_account_id', e.target.value)}>
            <option value="">— Choisir —</option>
            {(accounts || []).filter(a => String(a.id) !== String(form.from_account_id)).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (FCFA)">
            <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Frais de retrait (FCFA)">
            <Input type="number" value={form.fees} onChange={e => set('fees', e.target.value)} placeholder="0" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optionnel" />
          </Field>
        </div>

        {form.fees > 0 && (
          <p className="text-xs text-amber-400 bg-amber-400/10 px-3 py-2 rounded-lg">
            Total débité : {(parseFloat(form.amount) || 0) + (parseFloat(form.fees) || 0)} FCFA
            (montant + frais)
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={!valid}>Virer</Button>
        </div>
      </div>
    </Modal>
  )
}
