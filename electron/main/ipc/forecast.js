import { ipcMain } from 'electron'
import { getDb } from '../db.js'

export function registerForecastHandlers() {
  ipcMain.handle('forecast:getSessions', () =>
    getDb().prepare(`
      SELECT fs.*,
        COUNT(t.id) AS tx_count,
        COALESCE(SUM(CASE WHEN t.type='CREDIT' THEN t.amount ELSE -t.amount END), 0) AS net
      FROM forecast_sessions fs
      LEFT JOIN transactions t ON t.forecast_session_id = fs.id
      GROUP BY fs.id
      ORDER BY fs.created_at DESC
    `).all()
  )

  ipcMain.handle('forecast:createSession', (_, data) => {
    const r = getDb().prepare(
      'INSERT INTO forecast_sessions (name,description) VALUES (@name,@description)'
    ).run(data)
    return { id: r.lastInsertRowid, ...data, validated_at: null, tx_count: 0, net: 0 }
  })

  ipcMain.handle('forecast:getSession', (_, id) => {
    const db = getDb()
    const session = db.prepare('SELECT * FROM forecast_sessions WHERE id=?').get(id)
    const transactions = db.prepare(`
      SELECT t.*, a.name AS account_name,
        c.name AS category_name, c.color AS category_color, c.icon AS category_icon
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.forecast_session_id = ?
      ORDER BY t.date ASC
    `).all(id)
    return { session, transactions }
  })

  ipcMain.handle('forecast:addTransaction', (_, { session_id, ...data }) => {
    const db = getDb()
    const r = db.prepare(`
      INSERT INTO transactions
        (account_id,date,type,amount,category_id,description,forecast_session_id)
      VALUES (@account_id,@date,@type,@amount,@category_id,@description,@forecast_session_id)
    `).run({
      category_id: null,
      description: null,
      forecast_session_id: session_id,
      ...data
    })
    return { id: r.lastInsertRowid, forecast_session_id: session_id, ...data }
  })

  ipcMain.handle('forecast:validateSession', (_, id) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare('UPDATE forecast_sessions SET validated_at=CURRENT_TIMESTAMP WHERE id=?').run(id)
      db.prepare(
        'UPDATE transactions SET is_validated=1, forecast_session_id=NULL WHERE forecast_session_id=?'
      ).run(id)
    })()
    return { success: true }
  })

  ipcMain.handle('forecast:deleteSession', (_, id) => {
    const db = getDb()
    db.prepare('DELETE FROM transactions WHERE forecast_session_id=?').run(id)
    db.prepare('DELETE FROM forecast_sessions WHERE id=?').run(id)
    return { success: true }
  })
}
