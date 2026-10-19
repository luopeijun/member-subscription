import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dataDir = path.join(projectRoot, 'data')
fs.mkdirSync(dataDir, { recursive: true })

export const dbPath = path.join(dataDir, 'app.db')

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    category TEXT NOT NULL DEFAULT '其他',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cycle_months INTEGER NOT NULL,
    list_price INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    platform TEXT,
    account TEXT,
    started_at TEXT NOT NULL,
    next_renewal_override TEXT,
    auto_renew INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    shared_with TEXT,
    note TEXT,
    joint_parent_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
    joint_cost_mode TEXT NOT NULL DEFAULT 'split',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    paid_at TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT,
    joint_purchase_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS price_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    captured_at TEXT NOT NULL,
    price INTEGER NOT NULL,
    cycle_months INTEGER NOT NULL DEFAULT 0,
    platform TEXT,
    note TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_payments_sub ON payments(subscription_id, paid_at);
  CREATE INDEX IF NOT EXISTS idx_subs_plan ON subscriptions(plan_id);
  CREATE INDEX IF NOT EXISTS idx_snapshots_plan ON price_snapshots(plan_id, captured_at);
`)

const subscriptionColumns = db.prepare('PRAGMA table_info(subscriptions)').all() as {
  name: string
}[]
if (!subscriptionColumns.some((column) => column.name === 'joint_parent_id')) {
  db.exec(
    `ALTER TABLE subscriptions
     ADD COLUMN joint_parent_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL`,
  )
}
if (!subscriptionColumns.some((column) => column.name === 'joint_cost_mode')) {
  db.exec(
    `ALTER TABLE subscriptions
     ADD COLUMN joint_cost_mode TEXT NOT NULL DEFAULT 'split'`,
  )
}

const paymentColumns = db.prepare('PRAGMA table_info(payments)').all() as {
  name: string
}[]
if (!paymentColumns.some((column) => column.name === 'joint_purchase_id')) {
  db.exec('ALTER TABLE payments ADD COLUMN joint_purchase_id TEXT')
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_subs_joint ON subscriptions(joint_parent_id);
  CREATE INDEX IF NOT EXISTS idx_payments_joint ON payments(joint_purchase_id);
`)

const snapshotColumns = db.prepare('PRAGMA table_info(price_snapshots)').all() as {
  name: string
}[]
if (!snapshotColumns.some((column) => column.name === 'cycle_months')) {
  db.exec('ALTER TABLE price_snapshots ADD COLUMN cycle_months INTEGER NOT NULL DEFAULT 0')
  db.exec(
    `UPDATE price_snapshots
     SET cycle_months = COALESCE(
       (SELECT cycle_months FROM plans WHERE plans.id = price_snapshots.plan_id),
       12
     )`,
  )
}
