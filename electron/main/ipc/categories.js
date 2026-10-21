import { ipcMain } from 'electron'
import { getDb } from '../db.js'

export function registerCategoriesHandlers() {
  ipcMain.handle('categories:getAll', () =>
    getDb().prepare('SELECT * FROM categories ORDER BY flow, name').all()
  )

  // icon is optional: missing or '' is stored as NULL, like mobile createCategory.
  ipcMain.handle('categories:create', (_, data) => {
    const db = getDb()
    const r = db.prepare(
      'INSERT INTO categories (name,flow,color,icon) VALUES (@name,@flow,@color,@icon)'
    ).run({ name: data.name, flow: data.flow, color: data.color, icon: data.icon || null })
    return db.prepare('SELECT * FROM categories WHERE id=?').get(r.lastInsertRowid)
  })

  // icon undefined keeps the stored icon (one chosen on the phone survives a
  // desktop edit); null or '' clears it — same rule as mobile updateCategory.
  ipcMain.handle('categories:update', (_, { id, ...data }) => {
    const sets = ['name=@name', 'flow=@flow', 'color=@color']
    const params = { id, name: data.name, flow: data.flow, color: data.color }
    if (data.icon !== undefined) {
      sets.push('icon=@icon')
      params.icon = data.icon || null
    }
    getDb().prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id=@id`).run(params)
    return getDb().prepare('SELECT * FROM categories WHERE id=?').get(id)
  })

  ipcMain.handle('categories:remove', (_, id) => {
    getDb().prepare('DELETE FROM categories WHERE id=?').run(id)
    return { success: true }
  })
}
