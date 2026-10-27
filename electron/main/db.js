import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { app } from 'electron'

let db

function resolveDbPath() {
  // Dev et prod utilisent la même base : ~/.config/compta-perso/data/compta.db
  const userDataDir = join(app.getPath('userData'), 'data')
  if (!existsSync(userDataDir)) mkdirSync(userDataDir, { recursive: true })
  const dbDest = join(userDataDir, 'compta.db')
  // En production uniquement : copie la base bundlée au premier lancement
  if (app.isPackaged && !existsSync(dbDest)) {
    const bundled = join(process.resourcesPath, 'data', 'compta.db')
    if (existsSync(bundled)) copyFileSync(bundled, dbDest)
  }
  return dbDest
}

// Current data-migration level stored in PRAGMA user_version.
// Same number as the mobile app (src/db/database.js) so a database moved or
// pulled between the two stays coherent.
const DATA_VERSION = 1

export function getDb() {
  if (!db) db = openDatabase(resolveDbPath())
  return db
}

// Opens a database file and brings it to the current schema. Exported so a
// throw-away database can be checked outside the app's data folder.
export function openDatabase(path) {
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initSchema()
  migrateColumns()
  seedDefaults()
  migrateData()
  setAccountCurrencyDefault(db, true)
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ELECTRONIC','PHYSICAL')),
      provider TEXT,
      initial_balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'FCFA',
      color TEXT DEFAULT '#3B82F6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      flow TEXT NOT NULL CHECK(flow IN ('DEBIT','CREDIT','BOTH')),
      color TEXT DEFAULT '#6B7280',
      icon TEXT,
      builtin_key TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS forecast_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      validated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      date DATETIME NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('CREDIT','DEBIT')),
      amount REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT,
      forecast_session_id INTEGER REFERENCES forecast_sessions(id) ON DELETE CASCADE,
      is_validated INTEGER DEFAULT 0,
      transfer_pair_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      country_iso2 TEXT DEFAULT NULL,
      currency TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fee_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT,
      kind TEXT NOT NULL CHECK(kind IN ('percent','fixed','tiers')),
      value REAL DEFAULT NULL,
      tiers TEXT DEFAULT NULL,
      position INTEGER DEFAULT 0
    );
  `)
  // The profile always has its single row; currency NULL = not chosen yet
  db.prepare('INSERT OR IGNORE INTO profile (id) VALUES (1)').run()
}

export function tableColumns(d, table) {
  return d.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
}

// Table and column names are constants of this file, never user input.
// Returns true when the column was added.
function addColumnIfMissing(table, column, decl) {
  if (tableColumns(db, table).includes(column)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`)
  return true
}

// Databases created by an older version: add the missing columns.
// Only ADD COLUMN, never a drop or a rewrite (the owner's data is irreplaceable).
function migrateColumns() {
  addColumnIfMissing('transactions', 'fees', 'REAL DEFAULT 0')
  // position: accounts keep their creation order when the column appears
  if (addColumnIfMissing('accounts', 'position', 'INTEGER DEFAULT 0')) {
    db.exec('UPDATE accounts SET position = id')
  }
  addColumnIfMissing('accounts', 'fees_rate', 'REAL DEFAULT NULL')
  addColumnIfMissing('accounts', 'operator_id', 'TEXT DEFAULT NULL')
  addColumnIfMissing('accounts', 'operator_dismissed', 'INTEGER DEFAULT 0')
  addColumnIfMissing('categories', 'icon', 'TEXT')
  // builtin_key: one-time step when the column appears, existing built-in
  // categories get their key by name. No name is changed.
  if (addColumnIfMissing('categories', 'builtin_key', 'TEXT DEFAULT NULL')) {
    db.transaction(() => backfillBuiltinKeys(db))()
  }
}

// Stable key of each built-in category with its default French and English
// names. Same table as the mobile app (src/db/database.js); the key is what
// the UI translates (categories.builtin.<key>) while the stored name is still
// one of these defaults.
export const BUILTIN_CATEGORIES = [
  { key: 'food',       fr: 'Nourriture', en: 'Food' },
  { key: 'fuel',       fr: 'Essence',    en: 'Fuel' },
  { key: 'transport',  fr: 'Transport',  en: 'Transport' },
  { key: 'health',     fr: 'Sante',      en: 'Health' },
  { key: 'clothes',    fr: 'Vetements',  en: 'Clothes' },
  { key: 'leisure',    fr: 'Loisirs',    en: 'Leisure' },
  { key: 'bills',      fr: 'Factures',   en: 'Bills' },
  { key: 'salary',     fr: 'Salaire',    en: 'Salary' },
  { key: 'freelance',  fr: 'Freelance',  en: 'Freelance' },
  { key: 'withdrawal', fr: 'Retrait',    en: 'Withdrawal' },
  { key: 'other',      fr: 'Autres',     en: 'Other' },
]

// Normalized default name (fr or en) → key
const BUILTIN_KEY_BY_NAME = Object.fromEntries(
  BUILTIN_CATEGORIES.flatMap(c => [[normalizeName(c.fr), c.key], [normalizeName(c.en), c.key]])
)

// Categories without a key whose name is a default name (fr or en, case and
// accent-insensitive) get that key. One row per key: a key already held, or
// a second row with the same default name, is left alone. Only builtin_key
// is written; names, colours and icons are never touched. `onlyIds`
// (optional) limits the step to those category ids.
export function backfillBuiltinKeys(d, onlyIds) {
  const held = new Set(
    d.prepare('SELECT builtin_key FROM categories WHERE builtin_key IS NOT NULL').all().map(r => r.builtin_key)
  )
  let rows = d.prepare('SELECT id, name FROM categories WHERE builtin_key IS NULL ORDER BY id').all()
  if (onlyIds) rows = rows.filter(r => onlyIds.has(r.id))
  const upd = d.prepare('UPDATE categories SET builtin_key=? WHERE id=? AND builtin_key IS NULL')
  for (const row of rows) {
    const key = BUILTIN_KEY_BY_NAME[normalizeName(row.name)]
    if (!key || held.has(key)) continue
    upd.run(key, row.id)
    held.add(key)
  }
}

// Currency of the ledger: { code, iso2 }. The profile currency and country
// (set on the phone, carried by sync); without a profile currency, the
// currency most accounts store (legacy rows: 'FCFA') and no country; null
// when there is neither. Read only: nothing is written.
export function ledgerCurrency(d) {
  const p = d.prepare('SELECT currency, country_iso2 FROM profile WHERE id = 1').get()
  if (p?.currency) return { code: p.currency, iso2: p.country_iso2 || null }
  const a = d.prepare(`
    SELECT currency FROM accounts
    WHERE currency IS NOT NULL AND TRIM(currency) <> ''
    GROUP BY currency ORDER BY COUNT(*) DESC, MIN(id) LIMIT 1
  `).get()
  return { code: a?.currency || null, iso2: null }
}

// New accounts store the ledger currency (ledgerCurrency, chosen by the
// accounts:create handler), else the column default 'FCFA'. A row inserted
// with 'FCFA' (older renderer, or no currency known at that time) while a
// profile currency exists gets the profile currency from this connection-only
// (TEMP) trigger. Existing rows are never
// rewritten, and nothing is written to the database file's schema. A restore
// turns it off so snapshot rows keep their stored currency.
export function setAccountCurrencyDefault(d, on) {
  if (!on) {
    d.exec('DROP TRIGGER IF EXISTS temp.accounts_profile_currency')
    return
  }
  d.exec(`
    CREATE TEMP TRIGGER IF NOT EXISTS accounts_profile_currency
    AFTER INSERT ON main.accounts
    WHEN NEW.currency = 'FCFA'
      AND (SELECT currency FROM main.profile WHERE id = 1) IS NOT NULL
    BEGIN
      UPDATE accounts SET currency = (SELECT currency FROM main.profile WHERE id = 1)
      WHERE id = NEW.id;
    END
  `)
}

// Ionicons name of each built-in category, keyed by the normalized name
// (lowercase, no accents). Same table as the mobile app.
const BUILTIN_CATEGORY_ICONS = {
  autres: 'ellipsis-horizontal',
  avance: 'hourglass-outline',
  don: 'gift-outline',
  essence: 'speedometer-outline',
  factures: 'receipt-outline',
  forfaits: 'wifi-outline',
  loisirs: 'film-outline',
  mission: 'airplane-outline',
  nourriture: 'restaurant-outline',
  participation: 'people-outline',
  perdu: 'help-circle-outline',
  recharge: 'phone-portrait-outline',
  reglement: 'checkmark-done-outline',
  remboursement: 'arrow-undo-outline',
  remuneration: 'ribbon-outline',
  retrait: 'swap-horizontal-outline',
  salaire: 'briefcase-outline',
  sante: 'medkit-outline',
  transport: 'car-outline',
  vetements: 'shirt-outline',
  freelance: 'laptop-outline',
}

function normalizeName(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

// Built-in categories without an icon get theirs. Only empty icons are
// filled; a category the user gave an icon keeps it.
export function backfillCategoryIcons(d) {
  const rows = d.prepare("SELECT id, name FROM categories WHERE icon IS NULL OR icon = ''").all()
  const upd = d.prepare('UPDATE categories SET icon=? WHERE id=?')
  for (const row of rows) {
    const icon = BUILTIN_CATEGORY_ICONS[normalizeName(row.name)]
    if (icon) upd.run(icon, row.id)
  }
}

// Each account with a fees_rate and no fee rule gets one 'percent' rule
// carrying that rate (same fraction: 0.01 = 1 %). fees_rate is kept.
export function backfillFeeRules(d) {
  const rows = d.prepare(`
    SELECT a.id, a.fees_rate FROM accounts a
    WHERE a.fees_rate IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM fee_rules r WHERE r.account_id = a.id)
  `).all()
  const ins = d.prepare(
    "INSERT INTO fee_rules (account_id, name, kind, value, tiers, position) VALUES (?, NULL, 'percent', ?, NULL, 0)"
  )
  for (const row of rows) ins.run(row.id, row.fees_rate)
}

// One-shot data steps, run once per database (PRAGMA user_version)
function migrateData() {
  const version = db.pragma('user_version', { simple: true })
  if (version >= DATA_VERSION) return
  db.transaction(() => {
    backfillFeeRules(db)
    backfillCategoryIcons(db)
  })()
  db.pragma(`user_version = ${DATA_VERSION}`)
}

function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) as c FROM categories').get().c
  if (count > 0) return

  const cats = [
    { key: 'food',       flow: 'DEBIT',  color: '#F59E0B' },
    { key: 'fuel',       flow: 'DEBIT',  color: '#EF4444' },
    { key: 'transport',  flow: 'DEBIT',  color: '#8B5CF6' },
    { key: 'health',     flow: 'DEBIT',  color: '#EC4899' },
    { key: 'clothes',    flow: 'DEBIT',  color: '#06B6D4' },
    { key: 'leisure',    flow: 'DEBIT',  color: '#84CC16' },
    { key: 'bills',      flow: 'DEBIT',  color: '#F97316' },
    { key: 'salary',     flow: 'CREDIT', color: '#10B981' },
    { key: 'freelance',  flow: 'CREDIT', color: '#3B82F6' },
    { key: 'withdrawal', flow: 'BOTH',   color: '#6B7280' },
    { key: 'other',      flow: 'BOTH',   color: '#94A3B8' },
  ]

  // Seeded with the French default name (the stored name the UI translates
  // through builtin_key while it stays a default name)
  const ins = db.prepare(
    'INSERT INTO categories (name, flow, color, icon, builtin_key) VALUES (@name, @flow, @color, @icon, @key)'
  )
  for (const c of cats) {
    const name = BUILTIN_CATEGORIES.find(b => b.key === c.key).fr
    ins.run({ ...c, name, icon: BUILTIN_CATEGORY_ICONS[normalizeName(name)] || null })
  }
}
