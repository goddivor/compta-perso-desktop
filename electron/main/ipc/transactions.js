import { ipcMain } from 'electron'
import { getDb } from '../db.js'

export function registerTransactionsHandlers() {
  ipcMain.handle('transactions:getAll', (_, filters = {}) => {
    const db = getDb()
    const where = []
    const params = []

    if (filters.account_id)     { where.push('t.account_id = ?');    params.push(filters.account_id) }
    if (filters.category_id)    { where.push('t.category_id = ?');   params.push(filters.category_id) }
    if (filters.date_from)      { where.push('t.date >= ?');          params.push(filters.date_from) }
    if (filters.date_to)        { where.push('t.date <= ?');          params.push(filters.date_to) }
    if (filters.type)           { where.push('t.type = ?');           params.push(filters.type) }

    if (filters.include_forecast) {
      // include everything
    } else if (filters.forecast_only) {
      where.push('t.forecast_session_id IS NOT NULL')
    } else {
      where.push('t.forecast_session_id IS NULL')
    }

    const sql = `
      SELECT t.*,
        a.name AS account_name, a.type AS account_type, a.color AS account_color,
        c.name AS category_name, c.color AS category_color,
        fs.name AS forecast_session_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN forecast_sessions fs ON t.forecast_session_id = fs.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY t.date ASC, t.created_at ASC
      LIMIT 500
    `
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('transactions:create', (_, data) => {
    const db = getDb()
    const r = db.prepare(`
      INSERT INTO transactions
        (account_id, date, type, amount, category_id, description, forecast_session_id, transfer_pair_id)
      VALUES (@account_id, @date, @type, @amount, @category_id, @description, @forecast_session_id, @transfer_pair_id)
    `).run({
      category_id: null,
      description: null,
      forecast_session_id: null,
      transfer_pair_id: null,
      ...data
    })
    return { id: r.lastInsertRowid, ...data }
  })

  ipcMain.handle('transactions:getById', (_, id) => {
    return getDb().prepare('SELECT * FROM transactions WHERE id=?').get(id) || null
  })

  ipcMain.handle('transactions:update', (_, { id, ...data }) => {
    getDb().prepare(`
      UPDATE transactions
      SET account_id=@account_id, date=@date, type=@type, amount=@amount, fees=@fees,
          category_id=@category_id, description=@description
      WHERE id=@id
    `).run({ fees: 0, category_id: null, ...data, id })
    return { id, ...data }
  })

  ipcMain.handle('transactions:remove', (_, id) => {
    const db = getDb()
    const tx = db.prepare('SELECT transfer_pair_id FROM transactions WHERE id=?').get(id)
    if (tx?.transfer_pair_id) {
      db.prepare('DELETE FROM transactions WHERE id=? OR transfer_pair_id=?')
        .run(tx.transfer_pair_id, tx.transfer_pair_id)
    }
    db.prepare('DELETE FROM transactions WHERE id=?').run(id)
    return { success: true }
  })
}
