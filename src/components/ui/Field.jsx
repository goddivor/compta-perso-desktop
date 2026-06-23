export function Field({ label, children, error }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-gray-400">{label}</label>}
      {children}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}

export function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`bg-gray-800 border border-edge rounded-lg px-3 py-2 text-gray-100 text-sm
        placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full
        disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-500 ${className}`}
    />
  )
}

export function Select({ children, className = '', ...props }) {
  return (
    <select
      {...props}
      className={`bg-gray-800 border border-edge rounded-lg px-3 py-2 text-gray-100 text-sm
        focus:outline-none focus:border-blue-500 w-full ${className}`}
    >
      {children}
    </select>
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      {...props}
      className={`bg-gray-800 border border-edge rounded-lg px-3 py-2 text-gray-100 text-sm
        placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full resize-none ${className}`}
    />
  )
}
