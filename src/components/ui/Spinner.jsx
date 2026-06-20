export function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function Empty({ label = 'Aucune donnee' }) {
  return (
    <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
      {label}
    </div>
  )
}
