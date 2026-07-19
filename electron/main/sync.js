import { app } from 'electron'
import { join } from 'path'
import { hostname } from 'os'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { getDb } from './db.js'

const TABLES = ['accounts', 'categories', 'transactions', 'forecast_sessions']
const CONFIG_URL = 'https://compta-perso-sync-api.vercel.app/api/config'

function configPath() {
  return join(app.getPath('userData'), 'sync-config.json')
}

export function getSyncConfig() {
  try {
    if (existsSync(configPath())) {
      return JSON.parse(readFileSync(configPath(), 'utf8'))
    }
  } catch (_) {}
  return { api_url: '', token: '', last_push: null, last_pull: null }
}

export function saveSyncConfig(cfg) {
  const current = getSyncConfig()
  const next = { ...current, ...cfg }
  writeFileSync(configPath(), JSON.stringify(next, null, 2))
  return next
}

export function resetSyncConfig() {
  try { rmSync(configPath(), { force: true }) } catch (_) {}
}

function syncError(message, code) {
  const e = new Error(message)
  e.code = code
  return e
}

/**
 * Recupere l'URL de l'API et le token aupres du serveur de configuration
 * (cle inlinee au build via MAIN_VITE_CONFIG_KEY), puis les persiste.
 */
export async function fetchRemoteConfig() {
  const key = import.meta.env.MAIN_VITE_CONFIG_KEY
  if (!key) throw syncError('Cle de configuration absente du build', 'no_key')

  let res
  try {
    res = await fetch(CONFIG_URL, { headers: { 'X-Config-Key': key } })
  } catch (_) {
    throw syncError('Serveur de configuration injoignable', 'network')
  }

  if (res.status === 401 || res.status === 403) {
    throw syncError('Cle de configuration refusee par le serveur', 'unauthorized')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.ok || !body.api_url || !body.token) {
    throw syncError(body.error || `HTTP ${res.status}`, 'server')
  }

  const saved = saveSyncConfig({
    api_url: body.api_url,
    token: body.token,
    config_fetched_at: new Date().toISOString(),
  })
  return { config_fetched_at: saved.config_fetched_at }
}

function assertConfigured(cfg) {
  if (!cfg.api_url || !cfg.token) {
    throw new Error("Sync non configurée : renseigne l'URL de l'API et le token")
  }
}

async function api(cfg, path, options = {}) {
  const url = cfg.api_url.replace(/\/$/, '') + path
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.token}`,
      ...(options.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}

function dumpLocalData() {
  const db = getDb()
  const data = {}
  for (const t of TABLES) {
    data[t] = db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()
  }
  return data
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
}

function restoreLocalData(data) {
  const db = getDb()
  db.pragma('foreign_keys = OFF')
  try {
    db.transaction(() => {
      for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run()
      for (const t of TABLES) {
        const rows = data[t] || []
        if (!rows.length) continue
        const cols = tableColumns(db, t)
        // Only insert columns that exist locally (tolerates schema drift)
        const usable = cols.filter(c => c in rows[0])
        const stmt = db.prepare(
          `INSERT INTO ${t} (${usable.join(',')}) VALUES (${usable.map(c => `@${c}`).join(',')})`
        )
        for (const row of rows) {
          const clean = {}
          for (const c of usable) clean[c] = row[c] ?? null
          stmt.run(clean)
        }
      }
    })()
  } finally {
    db.pragma('foreign_keys = ON')
  }
}

export async function syncPush() {
  const cfg = getSyncConfig()
  assertConfigured(cfg)
  const data = dumpLocalData()
  const result = await api(cfg, '/api/push', {
    method: 'POST',
    body: JSON.stringify({ device: `pc-${hostname()}`, data }),
  })
  saveSyncConfig({ last_push: new Date().toISOString() })
  return result
}

export async function syncPull() {
  const cfg = getSyncConfig()
  assertConfigured(cfg)
  const result = await api(cfg, '/api/pull', { method: 'GET' })
  restoreLocalData(result.data)
  saveSyncConfig({ last_pull: new Date().toISOString() })
  return result.meta
}

export async function syncStatus() {
  const cfg = getSyncConfig()
  assertConfigured(cfg)
  const result = await api(cfg, '/api/status', { method: 'GET' })
  return result.meta
}
