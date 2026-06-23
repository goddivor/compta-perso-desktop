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

  ipcMain.handle('stats:getBalanceHistory', (_, { account_id, days = 60 }) => {
    const db = getDb()
    const account = db.prepare('SELECT * FROM accounts WHERE id=?').get(account_id)
    if (!account) return []

    const txs = db.prepare(`
      SELECT date, type, amount FROM transactions
      WHERE account_id=? AND forecast_session_id IS NULL
      ORDER BY date ASC, created_at ASC
    `).all(account_id)

    let balance = account.initial_balance
    const points = [{ date: account.created_at.slice(0, 10), balance }]

    for (const tx of txs) {
      balance += tx.type === 'CREDIT' ? tx.amount : -tx.amount
      const d = tx.date.slice(0, 10)
      if (points[points.length - 1].date === d) {
        points[points.length - 1].balance = balance
      } else {
        points.push({ date: d, balance })
      }
    }

    return points
  })

  ipcMain.handle('stats:getExpensesByCategory', (_, { account_id, date_from, date_to } = {}) => {
    const db = getDb()
    const where = ["t.type='DEBIT'", 't.forecast_session_id IS NULL']
    const params = []
    if (account_id) { where.push('t.account_id=?'); params.push(account_id) }
    if (date_from)  { where.push('t.date>=?');      params.push(date_from) }
    if (date_to)    { where.push('t.date<=?');      params.push(date_to) }

    return db.prepare(`
      SELECT COALESCE(c.name,'Sans catégorie') AS name,
             COALESCE(c.color,'#6B7280') AS color,
             COALESCE(c.icon,'') AS icon,
             SUM(t.amount) AS total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE ${where.join(' AND ')}
      GROUP BY t.category_id
      ORDER BY total DESC
    `).all(...params)
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

  ipcMain.handle('stats:getMonthlyFlow', (_, { account_id } = {}) => {
    const db = getDb()
    const where = ['t.forecast_session_id IS NULL']
    const params = []
    if (account_id) { where.push('t.account_id=?'); params.push(account_id) }

    return db.prepare(`
      SELECT strftime('%Y-%m', t.date) AS month,
        SUM(CASE WHEN t.type='CREDIT' THEN t.amount ELSE 0 END) AS income,
        SUM(CASE WHEN t.type='DEBIT'  THEN t.amount ELSE 0 END) AS expenses
      FROM transactions t
      WHERE ${where.join(' AND ')}
      GROUP BY month
      ORDER BY month ASC
      LIMIT 12
    `).all(...params)
  })
}
