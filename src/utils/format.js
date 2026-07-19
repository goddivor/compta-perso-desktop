// Locale dynamique ('fr-FR' | 'en-US'), pilotee par l'I18nProvider
let locale = 'fr-FR'

export const setFormatLocale = (l) => { locale = l }
export const getFormatLocale = () => locale

export const fmt = (n) =>
  new Intl.NumberFormat(locale).format(Math.round(n)) + ' FCFA'

export const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString(locale) : '—'

export const fmtDateTime = (s) =>
  s ? new Date(s).toLocaleString(locale) : '—'

export const fmtMonth = (ym) => {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

export const today = () => new Date().toISOString().slice(0, 10)
