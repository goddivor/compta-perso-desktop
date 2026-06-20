export function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function Empty({ label = 'Aucune donnée' }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm gap-2">
      <span className="text-3xl">📭</span>
      {label}
    </div>
  )
}
