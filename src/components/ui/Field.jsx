import { fmtParts } from '../../utils/format'
import { useAmountFormat } from '../../context/CurrencyContext'

export function Field({ label, children, error }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-muted">{label}</label>}
      {children}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}

export function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`bg-surface2 border border-edge rounded-xl px-3 py-2 text-ink text-sm
        placeholder-faint focus:outline-none focus:border-primary w-full
        disabled:opacity-50 disabled:cursor-not-allowed disabled:text-faint ${className}`}
    />
  )
}

// Amount field: the currency symbol sits on the side the amount format puts
// it ("₦ [2000]", "[2000] FCFA"); a plain Input while no currency is known
export function AmountInput({ className = '', disabled, ...props }) {
  useAmountFormat() // re-render when the format changes
  const { before, after, currency } = fmtParts(0)
  if (!currency) return <Input type="number" disabled={disabled} className={className} {...props} />
  const prefix = before.trim()
  const suffix = after.trim()
  return (
    <div className={`flex items-center gap-2 bg-surface2 border border-edge rounded-xl px-3 w-full
      focus-within:border-primary ${disabled ? 'opacity-50' : ''} ${className}`}>
      {prefix && <span className="text-sm text-faint shrink-0 select-none">{prefix}</span>}
      <input
        type="number"
        disabled={disabled}
        {...props}
        className="flex-1 min-w-0 bg-transparent py-2 text-ink text-sm placeholder-faint focus:outline-none
          disabled:cursor-not-allowed disabled:text-faint"
      />
      {suffix && <span className="text-sm text-faint shrink-0 select-none">{suffix}</span>}
    </div>
  )
}

export function Select({ children, className = '', ...props }) {
  return (
    <select
      {...props}
      className={`bg-surface2 border border-edge rounded-xl px-3 py-2 text-ink text-sm
        focus:outline-none focus:border-primary w-full ${className}`}
    >
      {children}
    </select>
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      {...props}
      className={`bg-surface2 border border-edge rounded-xl px-3 py-2 text-ink text-sm
        placeholder-faint focus:outline-none focus:border-primary w-full resize-none ${className}`}
    />
  )
}
