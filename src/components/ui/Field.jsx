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
