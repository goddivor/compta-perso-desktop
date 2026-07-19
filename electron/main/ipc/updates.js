import { app, ipcMain, shell } from 'electron'
import { checkForUpdates, downloadUpdate, quitAndInstall } from '../updater.js'

const ALLOWED_ORIGINS = ['https://goddivor.github.io', 'https://github.com']

export function registerUpdatesHandlers() {
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:install', () => quitAndInstall())

  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('app:openExternal', (_, url) => {
    try {
      const { origin } = new URL(url)
      if (!ALLOWED_ORIGINS.includes(origin)) return { ok: false }
      shell.openExternal(url)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })
}
