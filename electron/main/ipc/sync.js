import { ipcMain } from 'electron'
import { getSyncConfig, fetchRemoteConfig, resetSyncConfig, syncPush, syncPull, syncStatus } from '../sync.js'

export function registerSyncHandlers() {
  // Ne renvoie JAMAIS le token (ni l'URL) au renderer
  ipcMain.handle('sync:getConfig', () => {
    const cfg = getSyncConfig()
    return {
      configured: !!(cfg.api_url && cfg.token),
      config_fetched_at: cfg.config_fetched_at || null,
      last_push: cfg.last_push || null,
      last_pull: cfg.last_pull || null,
    }
  })

  ipcMain.handle('sync:fetchConfig', async () => {
    try {
      const r = await fetchRemoteConfig()
      return { ok: true, ...r }
    } catch (e) {
      return { ok: false, error: e.message, code: e.code || 'server' }
    }
  })

  ipcMain.handle('sync:resetConfig', () => {
    resetSyncConfig()
    return { ok: true }
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
