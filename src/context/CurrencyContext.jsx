// Amount format of every amount: the ledger currency's registry symbol
// ('FCFA', '₦', 'R'…) and the profile country's amountFormat, resolved by
// the main process (window.api.registry.getAmountFormat). Read at start,
// again on every data tick (a sync pull may bring the profile) and when the
// main process swapped in new registry data. The module-level format of
// utils/format (fmt, fmtSigned, fmtParts) is set before the children render.
import { createContext, useContext, useEffect, useState } from 'react'
import { getAmountFormat, getCurrencyLabel, setAmountFormat, setCurrencyLabel } from '../utils/format'

const CurrencyContext = createContext({ label: '', format: null })

const sameValue = (a, b) => a.label === b.label && JSON.stringify(a.format) === JSON.stringify(b.format)

export function CurrencyProvider({ tick, children }) {
  const [value, setValue] = useState(null) // null until the first read
  const [revision, setRevision] = useState(0)

  useEffect(() => window.api.registry.onUpdated(() => setRevision(r => r + 1)), [])

  useEffect(() => {
    let alive = true
    window.api.registry.getAmountFormat()
      .then(({ label, format }) => ({ label: label || '', format: format || null }))
      .catch((e) => {
        console.warn('amount format: read failed', e?.message)
        return { label: getCurrencyLabel(), format: getAmountFormat() }
      })
      .then((next) => {
        if (alive) setValue(prev => (prev && sameValue(prev, next) ? prev : next))
      })
    return () => { alive = false }
  }, [tick, revision])

  if (!value) return null // a few ms at start: no amount without its currency
  setAmountFormat(value.format)
  setCurrencyLabel(value.label)
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

// { label, format } of the amounts; subscribing re-renders on a change
export const useAmountFormat = () => useContext(CurrencyContext)
