// Amount format of the ledger, resolved from the registry data (pure, no
// Electron or database import: also run in plain Node to check the table).
// Same rule as the mobile app (src/context/CurrencyContext.js
// resolveAmountFormat, src/registry/api.js currencySymbol).
//
// Returns { label, format }:
//   label   the symbol amounts carry: localSymbols[iso2] ?? narrowSymbol ??
//           symbol of the currency, kept exactly; the code itself when the
//           registry does not know it or its symbol is invisible; '' for no
//           code (bare numbers)
//   format  the country's amountFormat plus localSymbol (localSymbols[iso2]
//           of the country's main currency), normalized by the renderer
//           (src/utils/format.js); null without a country. Without it the
//           label is compacted ('F CFA' → 'FCFA'): the app locale's group
//           space would make "1 234 F CFA" read as a longer number.

const INVISIBLE = /[؜​-‏‪-‮⁠-⁩﻿]/g
const stripInvisible = (s) => String(s ?? '').replace(INVISIBLE, '')

export const currencySymbol = (currency, iso2) =>
  currency ? (currency.localSymbols?.[iso2] ?? currency.narrowSymbol ?? currency.symbol) : ''

export function resolveAmountFormat(code, iso2, { countries, currencies }) {
  if (!code) return { label: '', format: null }
  const iso = iso2 ? String(iso2).toUpperCase() : null
  const cur = (currencies || []).find((c) => c.code === code)
  const symbol = cur ? stripInvisible(currencySymbol(cur, iso)) : ''
  const country = iso ? (countries || []).find((c) => c.iso2 === iso) : null
  const af = country?.amountFormat
  if (!af || typeof af !== 'object') {
    const compact = symbol.replace(/\s+/g, '')
    return { label: compact || code, format: null }
  }
  const main = (currencies || []).find((c) => c.code === country.currencies?.[0])
  return {
    label: symbol.trim() ? symbol : code,
    format: { ...af, localSymbol: main?.localSymbols?.[iso] ?? null },
  }
}
