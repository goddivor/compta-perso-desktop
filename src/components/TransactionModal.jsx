import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input, Select, Textarea } from './ui/Field'
import { fmt, today } from '../utils/format'

const emptyForm = {
  account_id: '', type: 'DEBIT', amount: '', fees: '', category_id: '',
  date: today(), description: '', linked_account_id: '',
}

export function TransactionModal({ isOpen, onClose, onSave, tx, accounts, categories, defaultAccountId }) {
  const [form, setForm]       = useState(emptyForm)
  const [partnerTx, setPartnerTx] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!isOpen) return
    setPartnerTx(null)

    if (tx) {
      ;(async () => {
        if (tx.transfer_pair_id) {
          const partner = await window.api.transactions.getById(tx.transfer_pair_id)
          setPartnerTx(partner)
          const debitTx  = tx.type === 'DEBIT' ? tx : partner
          const creditTx = tx.type === 'CREDIT' ? tx : partner
          setForm({
            account_id:        tx.account_id,
            type:              tx.type,
            amount:            String(creditTx.amount),
            fees:              (debitTx.fees || 0) ? String(debitTx.fees) : '',
            category_id:       tx.category_id || '',
            date:              (tx.date || today()).slice(0, 10),
            description:       tx.description || '',
            linked_account_id: partner?.account_id ?? '',
          })
        } else {
          setForm({
            account_id:        tx.account_id,
            type:              tx.type,
            amount:            String(tx.type === 'DEBIT' ? tx.amount - (tx.fees || 0) : tx.amount),
            fees:              tx.fees ? String(tx.fees) : '',
            category_id:       tx.category_id || '',
            date:              (tx.date || today()).slice(0, 10),
            description:       tx.description || '',
            linked_account_id: '',
          })
        }
      })()
    } else {
      setForm({ ...emptyForm, account_id: defaultAccountId || accounts?.[0]?.id || '' })
    }
  }, [isOpen])

  const filteredCats   = (categories || []).filter(c => c.flow === 'BOTH' || c.flow === form.type)
  const otherAccounts  = (accounts || []).filter(a => String(a.id) !== String(form.account_id))
  const isTransfer     = !!form.linked_account_id
  const baseAmount     = parseFloat(form.amount) || 0
  const feesAmt        = parseFloat(form.fees)   || 0
  const totalDebit     = baseAmount + feesAmt
  const wasTransfer    = !!tx?.transfer_pair_id

  const sourceAccount  = form.type === 'CREDIT'
    ? otherAccounts.find(a => String(a.id) === String(form.linked_account_id))
    : null
  const destAccount    = form.type === 'DEBIT'
    ? otherAccounts.find(a => String(a.id) === String(form.linked_account_id))
    : null
  const currentAccount = (accounts || []).find(a => String(a.id) === String(form.account_id))

  const valid = form.account_id && baseAmount > 0 && form.date

  const save = async () => {
    const isNowTransfer = isTransfer

    if (!tx) {
      if (isNowTransfer) {
        const from_id = form.type === 'DEBIT' ? Number(form.account_id) : Number(form.linked_account_id)
        const to_id   = form.type === 'CREDIT' ? Number(form.account_id) : Number(form.linked_account_id)
        await window.api.transfers.create({ from_account_id: from_id, to_account_id: to_id, amount: baseAmount, fees: feesAmt, date: form.date, description: form.description || null })
      } else {
        const storedAmount = form.type === 'DEBIT' ? totalDebit : baseAmount
        await window.api.transactions.create({ account_id: Number(form.account_id), type: form.type, amount: storedAmount, fees: feesAmt, category_id: form.category_id ? Number(form.category_id) : null, date: form.date, description: form.description || null })
      }
    } else if (wasTransfer && isNowTransfer) {
      // Transfer → Transfer : mise à jour des deux côtés
      let debitTxId, creditTxId, fromAccountId, toAccountId
      if (tx.type === 'DEBIT') {
        debitTxId = tx.id; creditTxId = tx.transfer_pair_id
        fromAccountId = Number(form.account_id); toAccountId = Number(form.linked_account_id)
      } else {
        debitTxId = tx.transfer_pair_id; creditTxId = tx.id
        fromAccountId = Number(form.linked_account_id); toAccountId = Number(form.account_id)
      }
      const catId = form.category_id ? Number(form.category_id) : null
      const catDebit  = tx.type === 'DEBIT'   ? catId : null
      const catCredit = tx.type === 'CREDIT'  ? catId : null
      await window.api.transfers.update({ debit_tx_id: debitTxId, credit_tx_id: creditTxId, from_account_id: fromAccountId, to_account_id: toAccountId, amount: baseAmount, fees: feesAmt, date: form.date, description: form.description || null, category_id_debit: catDebit, category_id_credit: catCredit })
    } else if (wasTransfer && !isNowTransfer) {
      // Transfer → Transaction simple : supprimer le partenaire
      const storedAmount = form.type === 'DEBIT' ? totalDebit : baseAmount
      await window.api.transfers.convertToSimple({ keep_tx_id: tx.id, delete_tx_id: tx.transfer_pair_id, account_id: Number(form.account_id), type: form.type, amount: storedAmount, fees: feesAmt, category_id: form.category_id ? Number(form.category_id) : null, date: form.date, description: form.description || null })
    } else if (!wasTransfer && isNowTransfer) {
      // Transaction simple → Transfer : supprimer l'ancienne, créer le transfert
      await window.api.transactions.remove(tx.id)
      const from_id = form.type === 'DEBIT' ? Number(form.account_id) : Number(form.linked_account_id)
      const to_id   = form.type === 'CREDIT' ? Number(form.account_id) : Number(form.linked_account_id)
      await window.api.transfers.create({ from_account_id: from_id, to_account_id: to_id, amount: baseAmount, fees: feesAmt, date: form.date, description: form.description || null })
    } else {
      // Simple → Simple
      const storedAmount = form.type === 'DEBIT' ? totalDebit : baseAmount
      await window.api.transactions.update({ id: tx.id, account_id: Number(form.account_id), type: form.type, amount: storedAmount, fees: feesAmt, category_id: form.category_id ? Number(form.category_id) : null, date: form.date, description: form.description || null })
    }

    onSave()
    onClose()
  }

  const modalTitle = wasTransfer
    ? 'Modifier le transfert'
    : tx ? 'Modifier la transaction' : 'Nouvelle transaction'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-4">
        {/* Ligne 1 : Compte + Source/Destination */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Compte">
            <Select value={form.account_id} onChange={e => set('account_id', e.target.value)}>
              <option value="">— Choisir —</option>
              {(accounts || []).map(a => (
                <option key={a.id} value={a.id}>{a.name}{a.provider ? ` (${a.provider})` : ''}</option>
              ))}
            </Select>
          </Field>
          {form.account_id ? (
            <Field label={form.type === 'CREDIT' ? 'Source (compte)' : 'Destination (compte)'}>
              <Select value={form.linked_account_id} onChange={e => set('linked_account_id', e.target.value)}>
                <option value="">Externe / Aucune</option>
                {otherAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}{a.provider ? ` (${a.provider})` : ''}</option>
                ))}
              </Select>
            </Field>
          ) : <div />}
        </div>

        {/* Ligne 2 : Type + Montant */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="DEBIT">Débit (dépense)</option>
              <option value="CREDIT">Crédit (entrée)</option>
            </Select>
          </Field>
          <Field label="Montant (FCFA)">
            <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" min="0" />
          </Field>
        </div>

        {/* Frais */}
        <Field label={`Frais${isTransfer ? ' de transfert' : ''} (FCFA)`}>
          <Input type="number" value={form.fees} onChange={e => set('fees', e.target.value)} placeholder="0" min="0" />
        </Field>

        {/* Récap total si frais */}
        {feesAmt > 0 && baseAmount > 0 && form.type === 'DEBIT' && !isTransfer && (
          <p className="text-xs text-gray-500 -mt-2">
            Total débité : <span className="text-rose-400 font-medium">{fmt(totalDebit)}</span>
            <span className="text-gray-600 ml-1">(dont {fmt(feesAmt)} frais)</span>
          </p>
        )}

        {/* Aperçu transfert */}
        {isTransfer && baseAmount > 0 && (
          <div className="bg-gray-800 rounded-lg px-4 py-2.5 text-sm space-y-1">
            {form.type === 'CREDIT' && sourceAccount && (
              <>
                <p className="text-gray-400">
                  Débit <span style={{ color: sourceAccount.color }} className="font-medium">{sourceAccount.name}</span>
                  {' '}: <span className="text-rose-400 font-medium">-{fmt(totalDebit)}</span>
                  {feesAmt > 0 && <span className="text-xs text-gray-600 ml-1">(dont {fmt(feesAmt)} frais)</span>}
                </p>
                <p className="text-gray-400">
                  Crédit <span style={{ color: currentAccount?.color }} className="font-medium">{currentAccount?.name}</span>
                  {' '}: <span className="text-emerald-400 font-medium">+{fmt(baseAmount)}</span>
                </p>
              </>
            )}
            {form.type === 'DEBIT' && destAccount && (
              <>
                <p className="text-gray-400">
                  Débit <span style={{ color: currentAccount?.color }} className="font-medium">{currentAccount?.name}</span>
                  {' '}: <span className="text-rose-400 font-medium">-{fmt(totalDebit)}</span>
                  {feesAmt > 0 && <span className="text-xs text-gray-600 ml-1">(dont {fmt(feesAmt)} frais)</span>}
                </p>
                <p className="text-gray-400">
                  Crédit <span style={{ color: destAccount.color }} className="font-medium">{destAccount.name}</span>
                  {' '}: <span className="text-emerald-400 font-medium">+{fmt(baseAmount)}</span>
                </p>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Catégorie">
            <Select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">— Sans catégorie —</option>
              {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optionnel..." />
        </Field>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
          <Button onClick={save} disabled={!valid} className="flex-1">
            {isTransfer
              ? (tx ? 'Modifier le transfert' : 'Créer le transfert')
              : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
