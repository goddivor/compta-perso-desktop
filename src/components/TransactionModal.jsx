import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input, Select, Textarea } from './ui/Field'
import { fmt, today } from '../utils/format'

const empty = {
  account_id: '', type: 'DEBIT', amount: '', category_id: '',
  date: today(), description: '', linked_account_id: '', fees: '',
}

export function TransactionModal({ isOpen, onClose, onSave, tx, accounts, categories, defaultAccountId }) {
  const [form, setForm] = useState(empty)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!isOpen) return
    setForm(tx ? {
      account_id:         tx.account_id,
      type:               tx.type,
      amount:             tx.amount,
      category_id:        tx.category_id || '',
      date:               (tx.date || today()).slice(0, 10),
      description:        tx.description || '',
      linked_account_id:  '',
      fees:               '',
    } : { ...empty, account_id: defaultAccountId || accounts?.[0]?.id || '' })
  }, [isOpen])

  const filteredCats  = (categories || []).filter(c => c.flow === 'BOTH' || c.flow === form.type)
  const otherAccounts = (accounts || []).filter(a => String(a.id) !== String(form.account_id))
  const isTransfer    = !!form.linked_account_id
  const amount        = parseFloat(form.amount) || 0
  const fees          = parseFloat(form.fees)   || 0
  const totalDebit    = amount + fees

  // Preview: what comes in / goes out
  const sourceAccount  = form.type === 'CREDIT'
    ? otherAccounts.find(a => String(a.id) === String(form.linked_account_id))
    : null
  const destAccount = form.type === 'DEBIT'
    ? otherAccounts.find(a => String(a.id) === String(form.linked_account_id))
    : null
  const currentAccount = (accounts || []).find(a => String(a.id) === String(form.account_id))

  const valid = form.account_id && amount > 0 && form.date

  const save = async () => {
    if (isTransfer) {
      // Create transfer pair
      const from_id = form.type === 'DEBIT'
        ? Number(form.account_id)
        : Number(form.linked_account_id)
      const to_id = form.type === 'CREDIT'
        ? Number(form.account_id)
        : Number(form.linked_account_id)
      await window.api.transfers.create({
        from_account_id: from_id,
        to_account_id:   to_id,
        amount,
        fees,
        date:        form.date,
        description: form.description || null,
      })
    } else {
      const data = {
        account_id:  Number(form.account_id),
        type:        form.type,
        amount,
        category_id: form.category_id ? Number(form.category_id) : null,
        date:        form.date,
        description: form.description || null,
      }
      if (tx?.id) await window.api.transactions.update({ id: tx.id, ...data })
      else        await window.api.transactions.create(data)
    }
    onSave()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tx ? 'Modifier la transaction' : 'Nouvelle transaction'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Compte">
            <Select value={form.account_id} onChange={e => set('account_id', e.target.value)}>
              <option value="">— Choisir —</option>
              {(accounts || []).map(a => (
                <option key={a.id} value={a.id}>{a.name}{a.provider ? ` (${a.provider})` : ''}</option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={e => { set('type', e.target.value); set('linked_account_id', '') }}>
              <option value="DEBIT">Debit (depense)</option>
              <option value="CREDIT">Credit (entree)</option>
            </Select>
          </Field>
        </div>

        {/* Source / Destination */}
        {!tx && form.account_id && (
          <Field label={form.type === 'CREDIT' ? 'Source (compte)' : 'Destination (compte)'}>
            <Select value={form.linked_account_id} onChange={e => set('linked_account_id', e.target.value)}>
              <option value="">Externe / Aucune</option>
              {otherAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}{a.provider ? ` (${a.provider})` : ''}</option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (FCFA)">
            <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" min="0" />
          </Field>
          {isTransfer && (
            <Field label="Frais de transfert (FCFA)">
              <Input type="number" value={form.fees} onChange={e => set('fees', e.target.value)} placeholder="0" min="0" />
            </Field>
          )}
        </div>

        {/* Preview transfer amounts */}
        {isTransfer && amount > 0 && (
          <div className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm space-y-1">
            {form.type === 'CREDIT' && sourceAccount && (
              <>
                <p className="text-gray-400">
                  Debit <span style={{ color: sourceAccount.color }} className="font-medium">{sourceAccount.name}</span>
                  {' '}: <span className="text-rose-400 font-medium">-{fmt(totalDebit)}</span>
                  {fees > 0 && <span className="text-xs text-gray-600 ml-1">(dont {fmt(fees)} frais)</span>}
                </p>
                <p className="text-gray-400">
                  Credit <span style={{ color: currentAccount?.color }} className="font-medium">{currentAccount?.name}</span>
                  {' '}: <span className="text-emerald-400 font-medium">+{fmt(amount)}</span>
                </p>
              </>
            )}
            {form.type === 'DEBIT' && destAccount && (
              <>
                <p className="text-gray-400">
                  Debit <span style={{ color: currentAccount?.color }} className="font-medium">{currentAccount?.name}</span>
                  {' '}: <span className="text-rose-400 font-medium">-{fmt(totalDebit)}</span>
                  {fees > 0 && <span className="text-xs text-gray-600 ml-1">(dont {fmt(fees)} frais)</span>}
                </p>
                <p className="text-gray-400">
                  Credit <span style={{ color: destAccount.color }} className="font-medium">{destAccount.name}</span>
                  {' '}: <span className="text-emerald-400 font-medium">+{fmt(amount)}</span>
                </p>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          {!isTransfer && (
            <Field label="Categorie">
              <Select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">— Sans categorie —</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
        </div>

        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optionnel..." />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={!valid}>
            {isTransfer ? 'Creer le transfert' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
