export function Badge({ children, color = '#6B7280' }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: color + '22', color }}
    >
      {children}
    </span>
  )
}
