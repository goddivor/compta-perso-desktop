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

  // color, fees_rate and operator_id are optional: undefined keeps the stored
  // value (as mobile updateAccount). A sent fees_rate (a fraction, 0.01 = 1 %)
  // is written to the account's first 'percent' fee rule — updated, created
  // or deleted — and fees_rate then mirrors that rule, as mobile does.
  ipcMain.handle('accounts:update', (_, { id, ...data }) => {
    const db = getDb()
    const sets = ['name=@name', 'provider=@provider', 'initial_balance=@initial_balance']
    const params = {
      id,
      name: data.name,
      provider: data.provider || null,
      initial_balance: data.initial_balance || 0,
    }
    if (data.color !== undefined) { sets.push('color=@color'); params.color = data.color }
    if (data.operator_id !== undefined) { sets.push('operator_id=@operator_id'); params.operator_id = data.operator_id || null }
    db.transaction(() => {
      db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id=@id`).run(params)
      if (data.fees_rate !== undefined) setPercentRule(db, id, data.fees_rate)
    })()
    return db.prepare('SELECT * FROM accounts WHERE id=?').get(id)
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

// The account's first percent rule (ORDER BY position, id), or undefined
function firstPercentRule(db, accountId) {
  return db.prepare(
    "SELECT id, value FROM fee_rules WHERE account_id=? AND kind='percent' ORDER BY position, id LIMIT 1"
  ).get(accountId)
}

// rate set → update the first percent rule, or append one (name NULL) at the
// end of the account's rules; rate null → delete that rule. fees_rate then
// mirrors the (new) first percent rule, or NULL — mobile syncFeesRate.
function setPercentRule(db, accountId, rate) {
  const first = firstPercentRule(db, accountId)
  const value = rate == null || rate === '' ? null : Number(rate)
  if (value != null && Number.isFinite(value) && value >= 0) {
    if (first) {
      db.prepare('UPDATE fee_rules SET value=? WHERE id=?').run(value, first.id)
    } else {
      const { p } = db.prepare(
        'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM fee_rules WHERE account_id=?'
      ).get(accountId)
      db.prepare(
        "INSERT INTO fee_rules (account_id, name, kind, value, tiers, position) VALUES (?, NULL, 'percent', ?, NULL, ?)"
      ).run(accountId, value, p)
    }
  } else if (value == null && first) {
    db.prepare('DELETE FROM fee_rules WHERE id=?').run(first.id)
  } else if (value != null) {
    throw new Error('Invalid fee rate')
  }
  const next = firstPercentRule(db, accountId)
  db.prepare('UPDATE accounts SET fees_rate=? WHERE id=?').run(next ? next.value : null, accountId)
}
