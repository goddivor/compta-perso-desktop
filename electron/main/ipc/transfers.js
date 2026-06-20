import { ipcMain } from 'electron'
import { getDb } from '../db.js'

export function registerTransfersHandlers() {
  ipcMain.handle('transfers:create', (_, { from_account_id, to_account_id, amount, fees, date, description }) => {
    const db = getDb()
    const run = db.transaction(() => {
      const totalDebit = amount + (fees || 0)

      const r1 = db.prepare(
        "INSERT INTO transactions (account_id,date,type,amount,fees,description) VALUES (?,?,'DEBIT',?,?,?)"
      ).run(from_account_id, date, totalDebit, fees || 0, description || null)

      const r2 = db.prepare(
        "INSERT INTO transactions (account_id,date,type,amount,description) VALUES (?,?,'CREDIT',?,?)"
      ).run(to_account_id, date, amount, description || 'Retrait reçu')

      db.prepare('UPDATE transactions SET transfer_pair_id=? WHERE id=?').run(r2.lastInsertRowid, r1.lastInsertRowid)
      db.prepare('UPDATE transactions SET transfer_pair_id=? WHERE id=?').run(r1.lastInsertRowid, r2.lastInsertRowid)

      return { from_tx_id: r1.lastInsertRowid, to_tx_id: r2.lastInsertRowid }
    })
    return run()
  })
}
