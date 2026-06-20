export const fmt = (n) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'

export const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('fr-FR') : '—'

export const fmtMonth = (ym) => {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

export const today = () => new Date().toISOString().slice(0, 10)
