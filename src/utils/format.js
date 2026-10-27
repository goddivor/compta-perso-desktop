// Amount and date formatting helpers. Same rules as the mobile app
// (src/utils/format.js).
//
// The locale ('fr-FR' | 'en-US') follows the app language (set by the
// I18nProvider). It drives dates, and amounts only while no country amount
// format is known.
//
// Amounts follow the profile country's registry amountFormat (registry v2,
// countries[].amountFormat): symbol before or after the number, the exact
// spaces of the data (U+00A0 / U+202F kept), the group separator. Set by the
// CurrencyProvider (context/CurrencyContext.jsx) from window.api.registry:
//   setAmountFormat(format)  the country's { pattern, signPattern,
//                            alphaPattern, group, decimal, localSymbol } or null
//   setCurrencyLabel(label)  the symbol shown: the registry symbol of the
//                            profile currency ('FCFA', '₦', 'R'), its code
//                            when unknown; '' when no currency is known
//                            (bare numbers)
// Pattern choice (registry SCHEMA "Amount format"): `pattern` when the symbol
// is the country's own (localSymbols[country] of its main currency); else
// `signPattern` when the symbol's character next to the number is a Unicode
// symbol (₦, $, ₵), `alphaPattern` for a letter (Ksh, KES).
// Without a country format: the app locale's separators and
// "2 000 SYMBOL", as before.
// Amounts are whole: the ledger stores whole amounts, every figure is rounded.
// Sign convention: the minus (U+2212) or plus goes before the whole amount,
// symbol included, as CLDR does: −₦2,000, −R2 000, −2 000 FCFA.

let locale = 'fr-FR'
export const setFormatLocale = (l) => {
  const next = l || 'fr-FR'
  if (next === locale) return
  locale = next
  compile()
}
export const getFormatLocale = () => locale

const MINUS = '−'
const NUMBER = '#,##0'
const PLACEHOLDER = '¤' // ¤
// Invisible characters the data may carry (zero-width, bidi marks, BOM):
// dropped, never injected
const INVISIBLE = /[؜​-‏‪-‮⁠-⁩﻿]/g
export const stripInvisible = (s) => String(s ?? '').replace(INVISIBLE, '')

const SYMBOL_CHAR = /^\p{S}$/u

let currencyLabel = ''
let countryFormat = null
// Compiled form: { before, after, group, decimal } (group null → app locale's Intl)
let shape = { before: '', after: '', group: null, decimal: null }

const validPattern = (p) => typeof p === 'string' && p.includes(NUMBER) && p.includes(PLACEHOLDER)

// A registry amountFormat (+ localSymbol) cleaned, or null when unusable
export function normalizeAmountFormat(f) {
  if (!f || typeof f !== 'object') return null
  const pattern = stripInvisible(f.pattern)
  if (!validPattern(pattern)) return null
  const pick = (p) => (validPattern(stripInvisible(p)) ? stripInvisible(p) : pattern)
  return {
    pattern,
    signPattern: pick(f.signPattern),
    alphaPattern: pick(f.alphaPattern),
    group: typeof f.group === 'string' ? f.group : ',',
    decimal: typeof f.decimal === 'string' && f.decimal ? f.decimal : '.',
    localSymbol: f.localSymbol ? stripInvisible(f.localSymbol) : null,
  }
}

function compile() {
  const symbol = currencyLabel
  const f = countryFormat
  if (!f) {
    shape = { before: '', after: symbol ? ' ' + symbol : '', group: null, decimal: null }
    return
  }
  let pattern = f.pattern
  if (symbol && symbol !== f.localSymbol) {
    const leading = f.signPattern.indexOf(PLACEHOLDER) < f.signPattern.indexOf(NUMBER)
    const chars = Array.from(symbol)
    const near = leading ? chars[chars.length - 1] : chars[0]
    pattern = SYMBOL_CHAR.test(near) ? f.signPattern : f.alphaPattern
  }
  const at = pattern.indexOf(NUMBER)
  let before = pattern.slice(0, at)
  let after = pattern.slice(at + NUMBER.length)
  if (symbol) {
    before = before.split(PLACEHOLDER).join(symbol)
    after = after.split(PLACEHOLDER).join(symbol)
  } else {
    // No currency yet: the bare number, without the symbol's spacing
    before = ''
    after = ''
  }
  shape = { before, after, group: f.group, decimal: f.decimal }
}

export const setCurrencyLabel = (label) => {
  const next = label ? stripInvisible(String(label)) : ''
  if (next === currencyLabel) return
  currencyLabel = next
  compile()
}
export const getCurrencyLabel = () => currencyLabel

// format: a registry amountFormat with its localSymbol (normalized here), or null
export const setAmountFormat = (format) => {
  const next = normalizeAmountFormat(format)
  if (JSON.stringify(next) === JSON.stringify(countryFormat)) return
  countryFormat = next
  compile()
}
export const getAmountFormat = () => countryFormat

// Digits of a whole, non-negative amount with the active group separator
function groupDigits(abs) {
  if (shape.group == null) return new Intl.NumberFormat(locale).format(abs)
  return String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, shape.group)
}

const whole = (n) => Math.round(Number(n) || 0)

// The grouped number alone ("2 000", "2,000"), "−" when negative
export const fmtNumber = (n) => {
  const v = whole(n)
  return (v < 0 ? MINUS : '') + groupDigits(Math.abs(v))
}

// Split form of an amount: { sign, before, number, after, currency }
// sign is '+' (CREDIT), '−' (U+2212, DEBIT or a negative amount) or '';
// before / after carry the symbol with its spacing on its side of the number
// ('' on the other side); currency is the bare symbol.
// sign + before + number + after === fmt(n) (no type) or fmtSigned(type, n).
export const fmtParts = (n, type = null) => {
  const v = whole(n)
  const sign = type === 'CREDIT' ? '+' : type === 'DEBIT' || (!type && v < 0) ? MINUS : ''
  return { sign, before: shape.before, number: groupDigits(Math.abs(v)), after: shape.after, currency: currencyLabel }
}

const join = (p) => p.sign + p.before + p.number + p.after

// "2 000 FCFA", "₦2,000", "R2 000", "−2 000 FCFA"; the bare number while no
// currency is known
export const fmt = (n) => join(fmtParts(n))

// "+₦2,000" (CREDIT) or "−₦2,000" (anything else); the amount's own sign is ignored
export const fmtSigned = (type, n) => join(fmtParts(n, type === 'CREDIT' ? 'CREDIT' : 'DEBIT'))

// A net amount: "+2 000 FCFA" above zero (or at zero with zeroPlus),
// "−2 000 FCFA" below, "0 FCFA" at zero
export const fmtNet = (n, { zeroPlus = false } = {}) => {
  const v = whole(n)
  return v > 0 || (v === 0 && zeroPlus) ? fmtSigned('CREDIT', v) : fmt(v)
}

export const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString(locale) : '—'

export const fmtDateTime = (s) =>
  s ? new Date(s).toLocaleString(locale) : '—'

export const fmtMonth = (ym) => {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

export const today = () => new Date().toISOString().slice(0, 10)
