import { app } from 'electron'
import { join } from 'path'
import { hostname } from 'os'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import {
  getDb, tableColumns, backfillFeeRules, backfillCategoryIcons, backfillBuiltinKeys,
  setAccountCurrencyDefault,
} from './db.js'

// Tables carried by a snapshot (push and pull). profile and fee_rules are v2:
// an old snapshot may lack them, see restoreLocalData. Same list as the
// mobile app's SYNC_TABLES.
const TABLES = ['accounts', 'categories', 'transactions', 'forecast_sessions', 'fee_rules', 'profile']

// Tables every snapshot, old or new, must carry as arrays
const CORE_TABLES = ['accounts', 'categories', 'transactions', 'forecast_sessions']
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

export function dumpLocalData() {
  const db = getDb()
  const data = {}
  for (const t of TABLES) {
    data[t] = db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()
  }
  return data
}

// True when a payload is a usable snapshot (the four v1 tables are arrays)
function isValidSnapshot(data) {
  return !!data && typeof data === 'object' && CORE_TABLES.every(t => Array.isArray(data[t]))
}

// better-sqlite3 binds only numbers, strings, bigints, buffers and null
function bindable(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint' || Buffer.isBuffer(v)) return v
  return JSON.stringify(v) // e.g. fee_rules.tiers sent as an array
}

// Inserts rows keeping only the columns that exist locally AND that the row
// carries: a snapshot column unknown here is dropped, a local column absent
// from the snapshot takes its default. Neither aborts the restore.
function insertRows(db, table, rows) {
  const cols = tableColumns(db, table)
  const stmts = new Map()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const usable = cols.filter(c => row[c] !== undefined)
    if (!usable.length) continue
    const key = usable.join(',')
    let stmt = stmts.get(key)
    if (!stmt) {
      stmt = db.prepare(`INSERT INTO ${table} (${key}) VALUES (${usable.map(() => '?').join(',')})`)
      stmts.set(key, stmt)
    }
    stmt.run(usable.map(c => bindable(row[c])))
  }
}

// Replaces ALL local content with the cloud payload, keeping ids, in one
// transaction with foreign keys off (any error rolls everything back).
// A payload without the four v1 tables throws before anything is deleted.
// Old snapshots (v1 clients, or a server without the v2 tables):
// - no profile with a currency → the local profile is kept (not wiped);
// - no fee_rules → each account with a fees_rate gets its percent rule back;
// - built-in categories without an icon get theirs;
// - categories sent without a builtin_key field get theirs by name (a row
//   that carries the field, even null, keeps it as sent).
// Every column, builtin_key and accounts.currency included, is stored as sent.
export function restoreLocalData(data) {
  if (!isValidSnapshot(data)) throw new Error('Invalid snapshot: nothing restored')
  const db = getDb()
  // A snapshot profile counts only when it carries a currency; it is always
  // stored as the singleton row id = 1.
  const snapProfile = Array.isArray(data.profile)
    ? data.profile.find(p => p && typeof p === 'object' && p.currency)
    : null
  const tables = snapProfile ? TABLES : TABLES.filter(t => t !== 'profile')
  const keylessIds = new Set(
    data.categories.filter(c => c && typeof c === 'object' && !('builtin_key' in c)).map(c => c.id)
  )
  db.pragma('foreign_keys = OFF')
  // Snapshot accounts keep the currency they carry
  setAccountCurrencyDefault(db, false)
  try {
    db.transaction(() => {
      for (const t of tables) db.prepare(`DELETE FROM ${t}`).run()
      for (const t of tables) {
        const rows = t === 'profile'
          ? [{ ...snapProfile, id: 1 }]
          : (Array.isArray(data[t]) ? data[t] : [])
        if (rows.length) insertRows(db, t, rows)
      }
      db.prepare('INSERT OR IGNORE INTO profile (id) VALUES (1)').run()
      backfillFeeRules(db)
      backfillCategoryIcons(db)
      if (keylessIds.size) backfillBuiltinKeys(db, keylessIds)
    })()
  } finally {
    setAccountCurrencyDefault(db, true)
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
  restoreLocalData(result && result.data)
  saveSyncConfig({ last_pull: new Date().toISOString() })
  return result.meta
}

export async function syncStatus() {
  const cfg = getSyncConfig()
  assertConfigured(cfg)
  const result = await api(cfg, '/api/status', { method: 'GET' })
  return result.meta
}
