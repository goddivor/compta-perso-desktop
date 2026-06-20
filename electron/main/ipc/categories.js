import { ipcMain } from 'electron'
import { getDb } from '../db.js'

export function registerCategoriesHandlers() {
  ipcMain.handle('categories:getAll', () =>
    getDb().prepare('SELECT * FROM categories ORDER BY flow, name').all()
  )

  ipcMain.handle('categories:create', (_, data) => {
    const r = getDb().prepare(
      'INSERT INTO categories (name,flow,color,icon) VALUES (@name,@flow,@color,@icon)'
    ).run(data)
    return { id: r.lastInsertRowid, ...data }
  })

  ipcMain.handle('categories:update', (_, { id, ...data }) => {
    getDb().prepare(
      'UPDATE categories SET name=@name, flow=@flow, color=@color, icon=@icon WHERE id=@id'
    ).run({ id, ...data })
    return { id, ...data }
  })

  ipcMain.handle('categories:remove', (_, id) => {
    getDb().prepare('DELETE FROM categories WHERE id=?').run(id)
    return { success: true }
  })
}
