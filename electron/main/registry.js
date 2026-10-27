// Registry data of the desktop: data/countries.json and data/currencies.json
// of the public compta-perso-registry (amount format and currency symbols).
// Same source and checks as the mobile app (src/registry/client.js,
// workspace docs/registry-v2.md §5):
//   manifest  releases/latest/download/index.json
//             { schema, tag, commit, files: { "<path>": "<sha256>" } }
//   files     cdn.jsdelivr.net/gh/goddivor/compta-perso-registry@<commit>/<path>,
//             each checked against its sha256 before it is kept
//
// Read order: the cache in userData/registry/ when its sha256 matches the one
// recorded in meta.json and its tag is not older than the copy bundled with
// the app (an unknown tag keeps the cache) (registry-snapshot/, its tag and commit in snapshot.json); else
// the bundled copy. The check compares the manifest with the sha of the data
// actually in use (cache or bundle), so a lost cache file is downloaded
// again. It runs in the background at start, at most once per 24 h; offline
// or failed, it is silent and the data in use stays. Downloads end on
// GitHub or jsDelivr over https (redirects included) and are capped at
// MAX_BODY_BYTES. Every cache write goes to a temporary file renamed over the
// target: a failed download never leaves a half-written file.
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
export const MAX_BODY_BYTES = 5 * 1024 * 1024
// Hosts a download may end on, after redirects
const ALLOWED_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'cdn.jsdelivr.net',
])

// path → key of the parsed file holding the list, and the bundled copy
const FILES = {
  'data/countries.json': { key: 'countries', bundled: bundledCountries },
  'data/currencies.json': { key: 'currencies', bundled: bundledCurrencies },
}

const rootDir = () => join(app.getPath('userData'), 'registry')
const cachePath = (path) => join(rootDir(), path.replace(/[^\w.-]+/g, '_'))
const metaPath = () => join(rootDir(), 'meta.json')
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

const isEntry = (e) => e !== null && typeof e === 'object' && !Array.isArray(e)

// A parsed registry file with its list kept to object entries, or null when
// no usable entry is left (not an object, no list, only junk entries)
export function clean(path, value) {
  if (!isEntry(value)) return null
  const key = FILES[path].key
  const list = Array.isArray(value[key]) ? value[key].filter(isEntry) : []
  return list.length ? { ...value, [key]: list } : null
}

// -1, 0 or 1 comparing two release tags ('v2.0.0'); null when either is not
// a version
export function compareTags(a, b) {
  const parse = (tag) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(tag ?? '').trim())
    return m ? m.slice(1).map(Number) : null
  }
  const x = parse(a)
  const y = parse(b)
  if (!x || !y) return null
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1
  return 0
}

/* ---------------------------------- files --------------------------------- */

function readText(file) {
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : null
  } catch (e) {
    console.warn('registry: cache read failed', file, e.message)
    return null
  }
}

function readJson(file) {
  const text = readText(file)
  try {
    return text == null ? null : JSON.parse(text)
  } catch (e) {
    console.warn('registry: cache parse failed', file, e.message)
    return null
  }
}

function writeAtomic(file, text) {
  mkdirSync(rootDir(), { recursive: true })
  const tmp = `${file}.${process.pid}-${Date.now()}.tmp`
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, file)
}

// { commit, tag, cached: { path: { sha, tag, commit } }, lastCheck }
// (a cached entry of the first builds is the bare sha, written with the
// manifest tag and commit of meta)
function loadMeta() {
  const m = readJson(metaPath())
  const meta = { commit: null, tag: null, cached: {}, lastCheck: 0, ...(isEntry(m) ? m : {}) }
  if (!isEntry(meta.cached)) meta.cached = {}
  return meta
}

const cachedEntry = (meta, path) => {
  const e = meta.cached[path]
  if (typeof e === 'string') return { sha: e, tag: meta.tag ?? null, commit: meta.commit ?? null }
  return isEntry(e) && typeof e.sha === 'string' ? e : null
}

function saveMeta(meta) {
  try { writeAtomic(metaPath(), JSON.stringify(meta)) } catch (e) { console.warn('registry: meta write failed', e.message) }
}

/* ---------------------------------- data ---------------------------------- */

// path → { value, sha, tag, source } of the file in use: value is the
// cleaned parsed file, sha and tag those of where it came from
const memory = new Map()

const bundledEntry = (path) => ({
  value: clean(path, FILES[path].bundled) || { [FILES[path].key]: [] },
  sha: snapshot.files?.[path] ?? null,
  tag: snapshot.tag ?? null,
  source: 'bundle',
})

// The cache when it is intact (sha256 as recorded) and not older than the
// bundled copy, else the bundled copy
function resolve(path, meta = loadMeta()) {
  const entry = cachedEntry(meta, path)
  if (!entry) return bundledEntry(path)
  if (compareTags(entry.tag, snapshot.tag) === -1) return bundledEntry(path)
  const text = readText(cachePath(path))
  if (text == null || sha256(text) !== entry.sha) return bundledEntry(path)
  let value = null
  try { value = clean(path, JSON.parse(text)) } catch { value = null }
  return value ? { value, sha: entry.sha, tag: entry.tag, source: 'cache' } : bundledEntry(path)
}

function inUse(path) {
  if (!memory.has(path)) memory.set(path, resolve(path))
  return memory.get(path)
}

// { countries, currencies } in use (cache, else the bundled copy); every
// entry is an object
export function getRegistryData() {
  return {
    countries: inUse('data/countries.json').value.countries,
    currencies: inUse('data/currencies.json').value.currencies,
  }
}

/* ---------------------------------- check --------------------------------- */

// True for an https URL on one of ALLOWED_HOSTS
export function allowedUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

// The body as text, rejected beyond maxBytes (announced or received)
export async function readCapped(res, maxBytes = MAX_BODY_BYTES) {
  const announced = Number(res.headers?.get?.('content-length'))
  if (Number.isFinite(announced) && announced > maxBytes) throw new Error(`body over ${maxBytes} bytes`)
  if (!res.body?.getReader) {
    const text = await res.text()
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error(`body over ${maxBytes} bytes`)
    return text
  }
  const reader = res.body.getReader()
  const chunks = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      reader.cancel().catch(() => {}) // the error below is what is reported
      throw new Error(`body over ${maxBytes} bytes`)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

export async function fetchText(url, timeoutMs, fetchImpl = net.fetch) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: controller.signal, cache: 'no-store' })
    const finalUrl = res.url || url
    if (!allowedUrl(finalUrl)) throw new Error(`unexpected location ${finalUrl}`)
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return await readCapped(res)
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
      // Compared with the data actually in use (cache or bundle, re-read
      // from disk: a cache file lost since start counts as the bundle)
      const current = resolve(path, meta)
      memory.set(path, current)
      if (current.sha === sha) continue
      // A manifest older than the bundle of this app: the bundle stays
      if (current.source === 'bundle' && compareTags(m.tag, current.tag) === -1) continue
      try {
        const text = await fetchText(`${CDN}${m.commit}/${path}`, FILE_TIMEOUT_MS)
        if (sha256(text) !== sha) throw new Error('sha256 mismatch')
        const value = clean(path, JSON.parse(text))
        if (!value) throw new Error('no list')
        writeAtomic(cachePath(path), text)
        meta.cached[path] = { sha, tag: m.tag ?? null, commit: m.commit }
        memory.set(path, { value, sha, tag: m.tag ?? null, source: 'cache' })
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
