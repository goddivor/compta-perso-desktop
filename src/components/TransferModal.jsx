import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input, Select } from './ui/Field'
import { today, fmt } from '../utils/format'
import { useT } from '../i18n'

export function TransferModal({ isOpen, onClose, onSave, accounts }) {
  const t = useT()
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
    <Modal isOpen={isOpen} onClose={onClose} title={t('transfer.title')}>
      <div className="space-y-4">
        <Field label={t('transfer.sourceAccount')}>
          <Select value={form.from_id} onChange={e => set('from_id', e.target.value)}>
            <option value="">{t('common.choose')}</option>
            {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>

        <Field label={t('transfer.destAccount')}>
          <Select value={form.to_id} onChange={e => set('to_id', e.target.value)}>
            <option value="">{t('common.choose')}</option>
            {(accounts || []).filter(a => String(a.id) !== String(form.from_id)).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('transfer.amountFcfa')}>
            <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
          </Field>
          <Field label={t('transfer.feesFcfa')}>
            <Input type="number" value={form.fees} onChange={e => set('fees', e.target.value)} placeholder="0" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('common.date')}>
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label={t('common.description')}>
            <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('common.optional')} />
          </Field>
        </div>

        {totalDebit > 0 && (
          <div className="bg-surface2 rounded-lg px-4 py-2.5 text-sm">
            <p className="text-muted">{t('transfer.debitSource')} <span className="text-rose-400 font-medium">{fmt(totalDebit)}</span></p>
            <p className="text-muted">{t('transfer.creditDest')} <span className="text-emerald-400 font-medium">{fmt(parseFloat(form.amount) || 0)}</span></p>
            {parseFloat(form.fees) > 0 && (
              <p className="text-xs text-faint mt-0.5">{t('transfer.inclFees', { x: fmt(parseFloat(form.fees)) })}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button onClick={save} disabled={!valid} className="flex-1">{t('transfer.submit')}</Button>
        </div>
      </div>
    </Modal>
  )
}
