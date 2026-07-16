import { ipcMain } from 'electron'
import { getSyncConfig, saveSyncConfig, syncPush, syncPull, syncStatus } from '../sync.js'

export function registerSyncHandlers() {
  ipcMain.handle('sync:getConfig', () => {
    const { token, ...rest } = getSyncConfig()
    return { ...rest, has_token: !!token, token }
  })

  ipcMain.handle('sync:setConfig', (_, cfg) => {
    const saved = saveSyncConfig({ api_url: cfg.api_url ?? '', token: cfg.token ?? '' })
    return { ok: true, api_url: saved.api_url }
  })

  ipcMain.handle('sync:push', async () => {
    try {
      const result = await syncPush()
      return { ok: true, meta: result.meta }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('sync:pull', async () => {
    try {
      const meta = await syncPull()
      return { ok: true, meta }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('sync:status', async () => {
    try {
      const meta = await syncStatus()
      return { ok: true, meta }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })
}
