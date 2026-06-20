export function Badge({ children, color = '#6B7280' }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color + '22', color }}
    >
      {children}
    </span>
  )
}

export function TypeBadge({ type }) {
  return type === 'CREDIT'
    ? <span className="text-xs font-medium text-emerald-400">Crédit</span>
    : <span className="text-xs font-medium text-rose-400">Débit</span>
}
