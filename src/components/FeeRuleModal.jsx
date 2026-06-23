import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Field'
import { fmt } from '../utils/format'
import { Percent, Trash2 } from 'lucide-react'

export function FeeRuleModal({ isOpen, onClose, onSave, account }) {
  const [rate, setRate] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setRate(account?.fees_rate != null ? String(account.fees_rate) : '')
  }, [isOpen, account?.id])

  const rateNum   = parseFloat(rate)
  const hasRate   = !isNaN(rateNum) && rateNum > 0
  const example   = hasRate ? Math.round(10000 * rateNum / 100) : null

  const save = async () => {
    await window.api.accounts.update({
      id:              account.id,
      name:            account.name,
      provider:        account.provider || null,
      initial_balance: account.initial_balance,
      color:           account.color,
      fees_rate:       hasRate ? rateNum : null,
    })
    onSave()
    onClose()
  }

  const clear = async () => {
    await window.api.accounts.update({
      id:              account.id,
      name:            account.name,
      provider:        account.provider || null,
      initial_balance: account.initial_balance,
      color:           account.color,
      fees_rate:       null,
    })
    onSave()
    onClose()
  }

  if (!account) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Règle de frais — ${account.name}`}>
      <div className="space-y-5">
        <p className="text-sm text-gray-400">
          Définissez un taux de frais automatique pour ce compte. Lors d'une transaction,
          une case à cocher vous proposera d'appliquer les frais calculés.
        </p>

        <Field label="Taux de frais (%)">
          <div className="relative">
            <Input
              type="number"
              value={rate}
              onChange={e => setRate(e.target.value)}
              placeholder="ex : 0.5"
              min="0"
              step="0.01"
            />
            <Percent size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </Field>

        {hasRate && (
          <div className="bg-gray-800 rounded-lg px-4 py-3 text-sm space-y-1">
            <p className="text-gray-400">
              Pour <span className="text-gray-200 font-medium">10 000 FCFA</span>
              {' '}→ frais = <span className="text-rose-400 font-medium">{fmt(example)} FCFA</span>
            </p>
            <p className="text-gray-400">
              Pour <span className="text-gray-200 font-medium">50 000 FCFA</span>
              {' '}→ frais = <span className="text-rose-400 font-medium">{fmt(Math.round(50000 * rateNum / 100))} FCFA</span>
            </p>
          </div>
        )}

        {!hasRate && account.fees_rate != null && (
          <p className="text-xs text-amber-500">
            Règle actuelle ({account.fees_rate}%) — laisser vide pour supprimer.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          {account.fees_rate != null && (
            <Button variant="danger" onClick={clear} className="flex-shrink-0 flex items-center gap-1.5">
              <Trash2 size={13} />
              Supprimer
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
          <Button onClick={save} className="flex-1">Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}
