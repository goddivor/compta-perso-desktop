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
  if (!db) {
    db = new Database(resolveDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
    migrateColumns()
    seedDefaults()
    migrateData()
  }
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
      icon TEXT
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
    { name: 'Nourriture',  flow: 'DEBIT',  color: '#F59E0B' },
    { name: 'Essence',     flow: 'DEBIT',  color: '#EF4444' },
    { name: 'Transport',   flow: 'DEBIT',  color: '#8B5CF6' },
    { name: 'Sante',       flow: 'DEBIT',  color: '#EC4899' },
    { name: 'Vetements',   flow: 'DEBIT',  color: '#06B6D4' },
    { name: 'Loisirs',     flow: 'DEBIT',  color: '#84CC16' },
    { name: 'Factures',    flow: 'DEBIT',  color: '#F97316' },
    { name: 'Salaire',     flow: 'CREDIT', color: '#10B981' },
    { name: 'Freelance',   flow: 'CREDIT', color: '#3B82F6' },
    { name: 'Retrait',     flow: 'BOTH',   color: '#6B7280' },
    { name: 'Autres',      flow: 'BOTH',   color: '#94A3B8' },
  ]

  const ins = db.prepare(
    'INSERT INTO categories (name, flow, color, icon) VALUES (@name, @flow, @color, @icon)'
  )
  for (const c of cats) ins.run({ ...c, icon: BUILTIN_CATEGORY_ICONS[normalizeName(c.name)] || null })
}
