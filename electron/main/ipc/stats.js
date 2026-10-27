import { ipcMain } from 'electron'
import { getDb } from '../db.js'

export function registerStatsHandlers() {
  ipcMain.handle('stats:getSummary', () => {
    const db = getDb()
    const accounts = db.prepare('SELECT * FROM accounts').all()
    let total_electronic = 0, total_physical = 0
    const enriched = accounts.map(a => {
      const { total } = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN type='CREDIT' THEN amount ELSE -amount END),0) AS total
        FROM transactions WHERE account_id=? AND forecast_session_id IS NULL
      `).get(a.id)
      const balance = a.initial_balance + total
      if (a.type === 'ELECTRONIC') total_electronic += balance
      else total_physical += balance
      return { ...a, current_balance: balance }
    })
    return { total_electronic, total_physical, accounts: enriched }
  })

  ipcMain.handle('stats:getDailyReport', (_, { account_id, date_from, date_to } = {}) => {
    const db = getDb()
    const where = ['t.forecast_session_id IS NULL']
    const params = []
    if (account_id) { where.push('t.account_id=?'); params.push(account_id) }
    if (date_from)  { where.push("date(t.date)>=?"); params.push(date_from) }
    if (date_to)    { where.push("date(t.date)<=?"); params.push(date_to) }

    return db.prepare(`
      SELECT
        date(t.date)                                                          AS day,
        SUM(CASE WHEN t.type='CREDIT' THEN t.amount ELSE 0 END)              AS total_credit,
        SUM(CASE WHEN t.type='DEBIT'  THEN t.amount ELSE 0 END)              AS total_debit,
        SUM(CASE WHEN t.type='CREDIT' THEN t.amount ELSE -t.amount END)      AS net,
        COUNT(*)                                                              AS tx_count
      FROM transactions t
      WHERE ${where.join(' AND ')}
      GROUP BY date(t.date)
      ORDER BY day DESC
    `).all(...params)
  })
}
