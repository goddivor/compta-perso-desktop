import { ipcMain } from 'electron'
import { getDb } from '../db.js'

export function registerAccountsHandlers() {
  ipcMain.handle('accounts:getAll', () => {
    return getDb().prepare(`
      SELECT a.*,
        a.initial_balance + COALESCE(
          (SELECT SUM(CASE WHEN type='CREDIT' THEN amount ELSE -amount END)
           FROM transactions WHERE account_id = a.id AND forecast_session_id IS NULL),
          0
        ) AS current_balance
      FROM accounts a
      ORDER BY position, id
    `).all()
  })

  ipcMain.handle('accounts:create', (_, data) => {
    const db = getDb()
    const r = db.prepare(
      'INSERT INTO accounts (name,type,provider,initial_balance,currency,color) VALUES (@name,@type,@provider,@initial_balance,@currency,@color)'
    ).run(data)
    return { id: r.lastInsertRowid, ...data }
  })

  ipcMain.handle('accounts:update', (_, { id, ...data }) => {
    getDb().prepare(
      'UPDATE accounts SET name=@name, provider=@provider, initial_balance=@initial_balance, color=@color WHERE id=@id'
    ).run({ id, ...data })
    return { id, ...data }
  })

  ipcMain.handle('accounts:remove', (_, id) => {
    getDb().prepare('DELETE FROM accounts WHERE id=?').run(id)
    return { success: true }
  })

  ipcMain.handle('accounts:reorder', (_, ids) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE accounts SET position=? WHERE id=?')
    db.transaction(() => { ids.forEach((id, i) => stmt.run(i, id)) })()
    return { success: true }
  })
}
