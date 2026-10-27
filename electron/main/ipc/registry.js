import { ipcMain } from 'electron'
import { getDb, ledgerCurrency } from '../db.js'
import { getRegistryData } from '../registry.js'
import { resolveAmountFormat } from '../amountFormat.js'

export function registerRegistryHandlers() {
  // { code, iso2, label, format } of every amount (see amountFormat.js):
  // the profile currency in the profile country; without a profile currency,
  // the accounts' stored currency without a country format
  ipcMain.handle('registry:getAmountFormat', () => {
    const { code, iso2 } = ledgerCurrency(getDb())
    return { code, iso2, ...resolveAmountFormat(code, iso2, getRegistryData()) }
  })
}
