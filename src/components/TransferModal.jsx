import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input, Select } from './ui/Field'
import { today, fmt } from '../utils/format'

export function TransferModal({ isOpen, onClose, onSave, accounts }) {
  const [form, setForm] = useState({ from_id: '', to_id: '', amount: '', fees: '', date: today(), description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!isOpen || !accounts) return
    const elec = accounts.filter(a => a.type === 'ELECTRONIC')
    const phys = accounts.filter(a => a.type === 'PHYSICAL')
    setForm(f => ({ ...f, from_id: elec[0]?.id || '', to_id: phys[0]?.id || '', amount: '', fees: '', date: today() }))
  }, [isOpen])

  const totalDebit = (parseFloat(form.amount) || 0) + (parseFloat(form.fees) || 0)
  const valid = form.from_id && form.to_id && form.amount && String(form.from_id) !== String(form.to_id)

  const save = async () => {
    await window.api.transfers.create({
      from_account_id: Number(form.from_id),
      to_account_id:   Number(form.to_id),
      amount:  parseFloat(form.amount),
      fees:    parseFloat(form.fees) || 0,
      date:    form.date,
      description: form.description || null,
    })
    onSave()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Retrait / Virement entre comptes">
      <div className="space-y-4">
        <Field label="Compte source (sera debite)">
          <Select value={form.from_id} onChange={e => set('from_id', e.target.value)}>
            <option value="">— Choisir —</option>
            {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>

        <Field label="Compte destination (sera credite)">
          <Select value={form.to_id} onChange={e => set('to_id', e.target.value)}>
            <option value="">— Choisir —</option>
            {(accounts || []).filter(a => String(a.id) !== String(form.from_id)).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant transfere (FCFA)">
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

        {totalDebit > 0 && (
          <div className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm">
            <p className="text-gray-400">Debit source : <span className="text-rose-400 font-medium">{fmt(totalDebit)}</span></p>
            <p className="text-gray-400">Credit destination : <span className="text-emerald-400 font-medium">{fmt(parseFloat(form.amount) || 0)}</span></p>
            {parseFloat(form.fees) > 0 && (
              <p className="text-xs text-gray-600 mt-0.5">dont {fmt(parseFloat(form.fees))} de frais</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
          <Button onClick={save} disabled={!valid} className="flex-1">Virer</Button>
        </div>
      </div>
    </Modal>
  )
}
