import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input, Select, Textarea } from './ui/Field'
import { today } from '../utils/format'

const empty = { account_id: '', type: 'DEBIT', amount: '', category_id: '', date: today(), description: '' }

export function TransactionModal({ isOpen, onClose, onSave, tx, accounts, categories }) {
  const [form, setForm] = useState(empty)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!isOpen) return
    setForm(tx ? {
      account_id:  tx.account_id,
      type:        tx.type,
      amount:      tx.amount,
      category_id: tx.category_id || '',
      date:        (tx.date || today()).slice(0, 10),
      description: tx.description || '',
    } : { ...empty, account_id: accounts?.[0]?.id || '' })
  }, [isOpen])

  const filteredCats = (categories || []).filter(c => c.flow === 'BOTH' || c.flow === form.type)
  const valid = form.account_id && form.amount && parseFloat(form.amount) > 0 && form.date

  const save = async () => {
    const data = {
      account_id:   Number(form.account_id),
      type:         form.type,
      amount:       parseFloat(form.amount),
      category_id:  form.category_id ? Number(form.category_id) : null,
      date:         form.date,
      description:  form.description || null,
    }
    if (tx?.id) await window.api.transactions.update({ id: tx.id, ...data })
    else        await window.api.transactions.create(data)
    onSave()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tx ? 'Modifier la transaction' : 'Nouvelle transaction'}>
      <div className="space-y-4">
        <Field label="Compte">
          <Select value={form.account_id} onChange={e => set('account_id', e.target.value)}>
            <option value="">— Choisir —</option>
            {(accounts || []).map(a => (
              <option key={a.id} value={a.id}>{a.name}{a.provider ? ` (${a.provider})` : ''}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="DEBIT">Debit (depense)</option>
              <option value="CREDIT">Credit (entree)</option>
            </Select>
          </Field>
          <Field label="Montant (FCFA)">
            <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" min="0" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Categorie">
            <Select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">— Sans categorie —</option>
              {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optionnel..." />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={!valid}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}
