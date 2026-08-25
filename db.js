const { createClient } = require('@libsql/client');
const path = require('path');

const databaseUrl = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'medical.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
  url: databaseUrl,
  ...(authToken ? { authToken } : {})
});

const schema = [
  `CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT NOT NULL UNIQUE,
    genre TEXT NOT NULL,
    total_copies INTEGER NOT NULL,
    available_copies INTEGER NOT NULL
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
    book_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    return_date TEXT,
    fine REAL DEFAULT 0,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
  )`
];

const sampleBooks = [
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

const ready = db.batch([
  ...schema.map((sql) => ({ sql, args: [] })),
  ...sampleBooks.map((args) => ({
    sql: 'INSERT OR IGNORE INTO books (title, author, isbn, genre, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?)',
    args
  })),
  ...sampleMembers.map((args) => ({
    sql: 'INSERT OR IGNORE INTO members (name, email, phone, membership_date) VALUES (?, ?, ?, ?)',
    args
  }))
], 'write');

module.exports = { db, ready };
