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
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS joint_renewals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    main_subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
    paid_at TEXT NOT NULL,
    total INTEGER NOT NULL,
    cycle_months INTEGER NOT NULL,
    cost_mode TEXT NOT NULL DEFAULT 'split',
    note TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    paid_at TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT,
    joint_renewal_id INTEGER REFERENCES joint_renewals(id) ON DELETE CASCADE,
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
const paymentColumns = db.prepare('PRAGMA table_info(payments)').all() as {
  name: string
}[]

if (!paymentColumns.some((column) => column.name === 'joint_renewal_id')) {
  db.exec(
    `ALTER TABLE payments
     ADD COLUMN joint_renewal_id INTEGER REFERENCES joint_renewals(id) ON DELETE CASCADE`,
  )
}

if (subscriptionColumns.some((column) => column.name === 'joint_parent_id')) {
  // Earlier versions stored joint memberships as persistent parent/child links.
  // Convert each group's latest purchase into one historical joint renewal record.
  const groups = db
    .prepare(
      `SELECT parent.id AS parent_id
       FROM subscriptions parent
       WHERE EXISTS (
         SELECT 1 FROM subscriptions child WHERE child.joint_parent_id = parent.id
       )
       ORDER BY parent.id`,
    )
    .all() as { parent_id: number }[]

  const insertJoint = db.prepare(
    `INSERT INTO joint_renewals
      (main_subscription_id, paid_at, total, cycle_months, cost_mode, note, created_at)
     VALUES (?, ?, ?, ?, 'main', ?, ?)`,
  )
  const linkPayment = db.prepare(
    'UPDATE payments SET joint_renewal_id = ? WHERE id = ?',
  )

  for (const group of groups) {
    const parent = db
      .prepare(
        `SELECT s.id, p.cycle_months
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.id = ?`,
      )
      .get(group.parent_id) as
      | { id: number; cycle_months: number }
      | undefined
    if (!parent) continue

    const latest = db
      .prepare(
        `SELECT paid_at FROM payments
         WHERE subscription_id = ?
         ORDER BY paid_at DESC, id DESC LIMIT 1`,
      )
      .get(parent.id) as { paid_at: string } | undefined
    if (!latest) continue

    const childIds = (
      db
        .prepare('SELECT id FROM subscriptions WHERE joint_parent_id = ? ORDER BY id')
        .all(parent.id) as { id: number }[]
    ).map((row) => row.id)
    const memberIds = [parent.id, ...childIds]
    const placeholders = memberIds.map(() => '?').join(', ')
    const rows = db
      .prepare(
        `SELECT id, amount FROM payments
         WHERE paid_at = ? AND subscription_id IN (${placeholders})
         ORDER BY id`,
      )
      .all(latest.paid_at, ...memberIds) as { id: number; amount: number }[]
    if (rows.length === 0) continue

    const total = rows.reduce((sum, row) => sum + row.amount, 0)
    if (total <= 0) continue

    const info = insertJoint.run(
      parent.id,
      latest.paid_at,
      total,
      parent.cycle_months > 0 ? parent.cycle_months : 12,
      '从旧联合会员关系迁移',
      new Date().toISOString(),
    )
    const jointRenewalId = Number(info.lastInsertRowid)
    for (const row of rows) {
      linkPayment.run(jointRenewalId, row.id)
    }
  }

  db.exec('UPDATE subscriptions SET joint_parent_id = NULL')

  // The old binding model tagged bundled members with a placeholder platform/note.
  // Those relationships now live in joint_renewals, so drop the misleading tags.
  db.exec("UPDATE subscriptions SET platform = NULL WHERE platform = '联合会员'")
  db.exec("UPDATE subscriptions SET note = NULL WHERE note GLOB '联合会员（*'")
}

// Best-effort cleanup of columns used by the old persistent-group model.
db.exec('DROP INDEX IF EXISTS idx_subs_joint')
db.exec('DROP INDEX IF EXISTS idx_payments_joint')
if (subscriptionColumns.some((column) => column.name === 'joint_parent_id')) {
  try {
    db.exec('ALTER TABLE subscriptions DROP COLUMN joint_parent_id')
  } catch {
    // Older SQLite builds may not support DROP COLUMN; the column is unused.
  }
}
if (subscriptionColumns.some((column) => column.name === 'joint_cost_mode')) {
  try {
    db.exec('ALTER TABLE subscriptions DROP COLUMN joint_cost_mode')
  } catch {
    // Older SQLite builds may not support DROP COLUMN; the column is unused.
  }
}
if (paymentColumns.some((column) => column.name === 'joint_purchase_id')) {
  try {
    db.exec('ALTER TABLE payments DROP COLUMN joint_purchase_id')
  } catch {
    // Older SQLite builds may not support DROP COLUMN; the column is unused.
  }
}

db.exec(
  'CREATE INDEX IF NOT EXISTS idx_payments_joint_renewal ON payments(joint_renewal_id)',
)

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
