import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Field'
import { fmt, getFormatLocale } from '../utils/format'
import { useT } from '../i18n'
import { Percent, Trash2 } from 'lucide-react'

// fees_rate is stored as a fraction (0.01 = 1 %); the user reads and types a percentage.
// Rounding to 6 decimals of a percent hides float noise (0.015 * 100 = 1.5000000000000002).
export const rateToPercent = (rate) => Math.round(rate * 1e8) / 1e6
const percentToRate = (pct) => Math.round(pct * 1e6) / 1e8

// Plain number in the app locale, e.g. 1.5 → "1,5" (fr) / "1.5" (en)
export const fmtPercentNumber = (rate) =>
  new Intl.NumberFormat(getFormatLocale(), { maximumFractionDigits: 4 }).format(rateToPercent(rate))

// Full percentage in the app locale, e.g. 0.01 → "1 %" (fr, narrow no-break space) / "1%" (en)
export const fmtRate = (rate) =>
  new Intl.NumberFormat(getFormatLocale(), { style: 'percent', maximumFractionDigits: 4 })
    .format(percentToRate(rateToPercent(rate)))

export function FeeRuleModal({ isOpen, onClose, onSave, account }) {
  const t = useT()
  const [rate, setRate] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setRate(account?.fees_rate != null ? String(rateToPercent(account.fees_rate)) : '')
  }, [isOpen, account?.id])

  const pctNum    = parseFloat(rate)
  const hasRate   = !isNaN(pctNum) && pctNum > 0
  const rateNum   = hasRate ? percentToRate(pctNum) : null
  const example   = hasRate ? Math.round(10000 * rateNum) : null

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
    <Modal isOpen={isOpen} onClose={onClose} title={t('feeRule.title', { name: account.name })}>
      <div className="space-y-5">
        <p className="text-sm text-muted">{t('feeRule.intro')}</p>

        <Field label={t('feeRule.rateLabel')}>
          <div className="relative">
            <Input
              type="number"
              value={rate}
              onChange={e => setRate(e.target.value)}
              placeholder={t('feeRule.ratePlaceholder')}
              min="0"
              step="0.01"
            />
            <Percent size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        </Field>

        {hasRate && (
          <div className="bg-surface2 rounded-lg px-4 py-3 text-sm space-y-1">
            <p className="text-muted">
              {t('feeRule.for')} <span className="text-content font-medium">{fmt(10000)}</span>
              {' '}{t('feeRule.feesEq')} <span className="text-rose-400 font-medium">{fmt(example)}</span>
            </p>
            <p className="text-muted">
              {t('feeRule.for')} <span className="text-content font-medium">{fmt(50000)}</span>
              {' '}{t('feeRule.feesEq')} <span className="text-rose-400 font-medium">{fmt(Math.round(50000 * rateNum))}</span>
            </p>
          </div>
        )}

        {!hasRate && account.fees_rate != null && (
          <p className="text-xs text-primary">
            {t('feeRule.current', { rate: fmtRate(account.fees_rate) })}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          {account.fees_rate != null && (
            <Button variant="danger" onClick={clear} className="flex-shrink-0 flex items-center gap-1.5">
              <Trash2 size={13} />
              {t('common.delete')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button onClick={save} className="flex-1">{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  )
}
