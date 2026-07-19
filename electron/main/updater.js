import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

let configured = false

function ensureConfigured() {
  if (configured) return
  configured = true

  autoUpdater.on('download-progress', (progress) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('update:progress', {
        percent: Math.round(progress.percent || 0),
        transferred: progress.transferred,
        total: progress.total,
      })
    }
  })
}

function extractNotes(info) {
  const notes = info?.releaseNotes
  if (!notes) return ''
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) return notes.map(n => n.note || '').join('\n')
  return ''
}

export async function checkForUpdates() {
  if (!app.isPackaged) return { available: false, dev: true }
  ensureConfigured()
  try {
    const result = await autoUpdater.checkForUpdates()
    const info = result?.updateInfo
    const available = !!info && info.version !== app.getVersion() &&
      (result?.isUpdateAvailable ?? true)
    if (!available) return { available: false }
    return {
      available: true,
      version: info.version,
      notes: extractNotes(info),
    }
  } catch (e) {
    return { available: false, error: e.message }
  }
}

export async function downloadUpdate() {
  if (!app.isPackaged) return { ok: false, error: 'Indisponible en mode developpement' }
  ensureConfigured()
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export function quitAndInstall() {
  if (!app.isPackaged) return { ok: false }
  autoUpdater.quitAndInstall()
  return { ok: true }
}

/**
 * Verification silencieuse au demarrage : si une mise a jour est disponible,
 * notifie le renderer via l'event `update:available`.
 */
export function scheduleStartupCheck() {
  if (!app.isPackaged) return
  setTimeout(async () => {
    const result = await checkForUpdates()
    if (!result.available) return
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('update:available', {
        version: result.version,
        notes: result.notes,
      })
    }
  }, 5000)
}
