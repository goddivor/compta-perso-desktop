import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db

export function getDb() {
  if (!db) {
    const dataDir = join(process.cwd(), 'data')
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

    db = new Database(join(dataDir, 'compta.db'))
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
    seedDefaults()
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
  `)
}

function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) as c FROM categories').get().c
  if (count > 0) return

  const cats = [
    { name: 'Nourriture',  flow: 'DEBIT',  color: '#F59E0B', icon: '' },
    { name: 'Essence',     flow: 'DEBIT',  color: '#EF4444', icon: '' },
    { name: 'Transport',   flow: 'DEBIT',  color: '#8B5CF6', icon: '' },
    { name: 'Sante',       flow: 'DEBIT',  color: '#EC4899', icon: '' },
    { name: 'Vetements',   flow: 'DEBIT',  color: '#06B6D4', icon: '' },
    { name: 'Loisirs',     flow: 'DEBIT',  color: '#84CC16', icon: '' },
    { name: 'Factures',    flow: 'DEBIT',  color: '#F97316', icon: '' },
    { name: 'Salaire',     flow: 'CREDIT', color: '#10B981', icon: '' },
    { name: 'Freelance',   flow: 'CREDIT', color: '#3B82F6', icon: '' },
    { name: 'Retrait',     flow: 'BOTH',   color: '#6B7280', icon: '' },
    { name: 'Autres',      flow: 'BOTH',   color: '#94A3B8', icon: '' },
  ]

  const ins = db.prepare(
    'INSERT INTO categories (name, flow, color, icon) VALUES (@name, @flow, @color, @icon)'
  )
  for (const c of cats) ins.run(c)
}
