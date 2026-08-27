const { createClient } = require('@libsql/client');
const path = require('path');

const databaseUrl = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'medical.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
  url: databaseUrl,
  ...(authToken ? { authToken } : {})
});

const schema = [
  `CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    barcode TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    total_units INTEGER NOT NULL,
    available_units INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    membership_date TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    return_date TEXT,
    fine REAL DEFAULT 0,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
  )`
];

const sampleMedicines = [
  ['Paracetamol 500mg', 'GlaxoSmithKline', '8901234567890', 'Analgesic', 50, 50],
  ['Amoxicillin 250mg', 'Pfizer India', '8909876543210', 'Antibiotic', 40, 40],
  ['Ibuprofen 400mg', 'Abbott Laboratories', '8901122334455', 'Anti-inflammatory', 60, 60],
  ['Lipitor 20mg', 'Pfizer Inc', '8904433221100', 'Cardiovascular', 30, 30],
  ['Omeprazole 20mg', 'AstraZeneca', '8905566778899', 'Gastrointestinal', 45, 45],
  ['Cetirizine 10mg', 'Cipla Ltd', '8906677889900', 'Antihistamine', 35, 35]
];

const sampleMembers = [
  ['Aarav Sharma', 'aarav.patient@example.com', '9876543210', '2026-01-10'],
  ['Diya Patel', 'diya.patient@example.com', '9876543211', '2026-02-15'],
  ['Kabir Singh', 'kabir.patient@example.com', '9876543212', '2026-03-05'],
  ['Meera Nair', 'meera.patient@example.com', '9876543213', '2026-04-22']
];

async function migrateLegacySchema() {
  const legacyTable = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'books'");
  if (!legacyTable.rows[0]) return;

  await db.execute('ALTER TABLE books RENAME TO medicines');
  await db.execute('ALTER TABLE medicines RENAME COLUMN title TO name');
  await db.execute('ALTER TABLE medicines RENAME COLUMN author TO manufacturer');
  await db.execute('ALTER TABLE medicines RENAME COLUMN isbn TO barcode');
  await db.execute('ALTER TABLE medicines RENAME COLUMN genre TO category');
  await db.execute('ALTER TABLE medicines RENAME COLUMN total_copies TO total_units');
  await db.execute('ALTER TABLE medicines RENAME COLUMN available_copies TO available_units');
  await db.execute('ALTER TABLE issues RENAME COLUMN book_id TO medicine_id');
}

const ready = (async () => {
  await migrateLegacySchema();
  await db.batch([
    ...schema.map((sql) => ({ sql, args: [] })),
    ...sampleMedicines.map((args) => ({
    sql: 'INSERT OR IGNORE INTO medicines (name, manufacturer, barcode, category, total_units, available_units) VALUES (?, ?, ?, ?, ?, ?)',
    args
  })),
  ...sampleMembers.map((args) => ({
    sql: 'INSERT OR IGNORE INTO members (name, email, phone, membership_date) VALUES (?, ?, ?, ?)',
    args
  }))
  ], 'write');
})();

module.exports = { db, ready };
