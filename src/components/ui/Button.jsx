export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, type = 'button', className = '' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5' }
  const variants = {
    primary:   'bg-primary hover:bg-primary600 text-primaryInk font-semibold',
    secondary: 'bg-surface2 hover:bg-edge text-content',
    danger:    'bg-rose-500/15 hover:bg-rose-500/30 text-rose-400',
    ghost:     'hover:bg-surface2 text-muted hover:text-ink',
    success:   'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400',
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
