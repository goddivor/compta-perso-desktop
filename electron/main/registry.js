// Registry data of the desktop: data/countries.json and data/currencies.json
// of the public compta-perso-registry (amount format and currency symbols).
// Same source and checks as the mobile app (src/registry/client.js,
// workspace docs/registry-v2.md §5):
//   manifest  releases/latest/download/index.json
//             { schema, tag, commit, files: { "<path>": "<sha256>" } }
//   files     cdn.jsdelivr.net/gh/goddivor/compta-perso-registry@<commit>/<path>,
//             each checked against its sha256 before it is kept
//
// Read order: the cache in userData/registry/, then the copy bundled with the
// app (registry-snapshot/, its tag and commit in snapshot.json). The check
// runs in the background at start, at most once per 24 h; offline or failed,
// it is silent and the data in use stays. Every cache write goes to a
// temporary file renamed over the target: a failed download never leaves a
// half-written file.
import { app, net } from 'electron'
import { createHash } from 'crypto'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import bundledCountries from './registry-snapshot/countries.json'
import bundledCurrencies from './registry-snapshot/currencies.json'
import snapshot from './registry-snapshot/snapshot.json'

export const MANIFEST_SCHEMA = 1 // highest manifest schema this app reads
const MANIFEST_URL = 'https://github.com/goddivor/compta-perso-registry/releases/latest/download/index.json'
const CDN = 'https://cdn.jsdelivr.net/gh/goddivor/compta-perso-registry@'
export const STARTUP_INTERVAL_MS = 24 * 60 * 60 * 1000
const MANIFEST_TIMEOUT_MS = 15000
const FILE_TIMEOUT_MS = 60000

// path → key of the parsed file holding the list, and the bundled copy
const FILES = {
  'data/countries.json': { key: 'countries', bundled: bundledCountries },
  'data/currencies.json': { key: 'currencies', bundled: bundledCurrencies },
}

const rootDir = () => join(app.getPath('userData'), 'registry')
const cachePath = (path) => join(rootDir(), path.replace(/[^\w.-]+/g, '_'))
const metaPath = () => join(rootDir(), 'meta.json')
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

// A parsed registry file is usable when its list is a non-empty array
const usable = (path, value) => {
  const list = value?.[FILES[path].key]
  return Array.isArray(list) && list.length > 0
}

/* ---------------------------------- files --------------------------------- */

function readJson(file) {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
  } catch (e) {
    console.warn('registry: cache read failed', file, e.message)
    return null
  }
}

function writeAtomic(file, text) {
  mkdirSync(rootDir(), { recursive: true })
  const tmp = `${file}.${process.pid}-${Date.now()}.tmp`
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, file)
}

// { commit, tag, cached: { path: sha }, lastCheck }
function loadMeta() {
  return { commit: null, tag: null, cached: {}, lastCheck: 0, ...(readJson(metaPath()) || {}) }
}

function saveMeta(meta) {
  try { writeAtomic(metaPath(), JSON.stringify(meta)) } catch (e) { console.warn('registry: meta write failed', e.message) }
}

/* ---------------------------------- data ---------------------------------- */

const memory = new Map() // path → parsed file in use

function load(path) {
  if (!memory.has(path)) {
    const cached = readJson(cachePath(path))
    memory.set(path, usable(path, cached) ? cached : FILES[path].bundled)
  }
  return memory.get(path)
}

// { countries, currencies } in use (cache, else the bundled copy)
export function getRegistryData() {
  return {
    countries: load('data/countries.json').countries,
    currencies: load('data/currencies.json').currencies,
  }
}

/* ---------------------------------- check --------------------------------- */

async function fetchText(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await net.fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchManifest() {
  const m = JSON.parse(await fetchText(MANIFEST_URL, MANIFEST_TIMEOUT_MS))
  if (!m || typeof m.schema !== 'number') throw new Error('invalid manifest')
  if (m.schema > MANIFEST_SCHEMA) return { unsupported: true }
  if (typeof m.commit !== 'string' || !/^[0-9a-f]{7,40}$/.test(m.commit) || !m.files || typeof m.files !== 'object') {
    throw new Error('invalid manifest')
  }
  return m
}

let running = null

// Reads the manifest and swaps in each data file whose sha256 changed.
// Resolves to the paths swapped in ([] when skipped, unchanged, offline or
// failed); never throws.
export function checkRegistry({ minInterval = STARTUP_INTERVAL_MS } = {}) {
  if (running) return running
  running = (async () => {
    const meta = loadMeta()
    const now = Date.now()
    if (now - (meta.lastCheck || 0) < minInterval) return []
    const m = await fetchManifest()
    if (m.unsupported) {
      meta.lastCheck = now
      saveMeta(meta)
      return []
    }
    const changed = []
    let failed = false
    for (const path of Object.keys(FILES)) {
      const sha = m.files[path]
      if (typeof sha !== 'string') continue
      // The file in use already has this content: the cache, or the bundled
      // copy while nothing was ever cached
      const inUse = meta.cached[path] || (existsSync(cachePath(path)) ? null : snapshot.files[path])
      if (inUse === sha) continue
      try {
        const text = await fetchText(`${CDN}${m.commit}/${path}`, FILE_TIMEOUT_MS)
        if (sha256(text) !== sha) throw new Error('sha256 mismatch')
        const value = JSON.parse(text)
        if (!usable(path, value)) throw new Error('no list')
        writeAtomic(cachePath(path), text)
        meta.cached[path] = sha
        memory.set(path, value)
        changed.push(path)
      } catch (e) {
        failed = true
        console.warn('registry: update failed', path, e.message)
      }
    }
    Object.assign(meta, { commit: m.commit, tag: m.tag ?? null })
    if (!failed) meta.lastCheck = now
    saveMeta(meta)
    return changed
  })()
    .catch((e) => {
      console.warn('registry: check failed', e.message)
      return []
    })
    .finally(() => { running = null })
  return running
}
