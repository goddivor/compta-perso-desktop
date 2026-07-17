export function Badge({ children, color = '#A89E92' }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: color + '22', color }}
    >
      {children}
    </span>
  )
}
