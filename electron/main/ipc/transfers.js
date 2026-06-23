import { ipcMain } from 'electron'
import { getDb } from '../db.js'

export function registerTransfersHandlers() {
  ipcMain.handle('transfers:create', (_, { from_account_id, to_account_id, amount, fees, date, description }) => {
    const db = getDb()
    return db.transaction(() => {
      const totalDebit = amount + (fees || 0)
      const r1 = db.prepare(
        "INSERT INTO transactions (account_id,date,type,amount,fees,description) VALUES (?,?,'DEBIT',?,?,?)"
      ).run(from_account_id, date, totalDebit, fees || 0, description || null)
      const r2 = db.prepare(
        "INSERT INTO transactions (account_id,date,type,amount,fees,description) VALUES (?,?,'CREDIT',?,0,?)"
      ).run(to_account_id, date, amount, description || 'Retrait reçu')
      db.prepare('UPDATE transactions SET transfer_pair_id=? WHERE id=?').run(r2.lastInsertRowid, r1.lastInsertRowid)
      db.prepare('UPDATE transactions SET transfer_pair_id=? WHERE id=?').run(r1.lastInsertRowid, r2.lastInsertRowid)
      return { from_tx_id: r1.lastInsertRowid, to_tx_id: r2.lastInsertRowid }
    })()
  })

  ipcMain.handle('transfers:update', (_, { debit_tx_id, credit_tx_id, from_account_id, to_account_id, amount, fees, date, description, category_id_debit, category_id_credit }) => {
    const db = getDb()
    db.transaction(() => {
      const totalDebit = amount + (fees || 0)
      db.prepare('UPDATE transactions SET account_id=?,date=?,amount=?,fees=?,category_id=?,description=? WHERE id=?')
        .run(from_account_id, date, totalDebit, fees || 0, category_id_debit || null, description || null, debit_tx_id)
      db.prepare('UPDATE transactions SET account_id=?,date=?,amount=?,fees=0,category_id=?,description=? WHERE id=?')
        .run(to_account_id, date, amount, category_id_credit || null, description || 'Retrait reçu', credit_tx_id)
    })()
    return { success: true }
  })

  ipcMain.handle('transfers:convertToSimple', (_, { keep_tx_id, delete_tx_id, account_id, type, amount, fees, category_id, date, description }) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare('DELETE FROM transactions WHERE id=?').run(delete_tx_id)
      db.prepare(`
        UPDATE transactions
        SET account_id=?, type=?, amount=?, fees=?, category_id=?, date=?, description=?, transfer_pair_id=NULL
        WHERE id=?
      `).run(account_id, type, amount, fees || 0, category_id || null, date, description || null, keep_tx_id)
    })()
    return { success: true }
  })
}
