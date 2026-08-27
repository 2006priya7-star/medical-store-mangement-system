const express = require('express');
const { db, ready } = require('../db');
const router = express.Router();

// Formats a date as YYYY-MM-DD for storing in the database.
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Gets all active dispensing records with the medicine and patient names.
router.get('/', async (req, res, next) => {
  try {
    await ready;
    const result = await db.execute(`SELECT issues.*, medicines.name AS medicine_name, members.name AS member_name
      FROM issues JOIN medicines ON issues.medicine_id = medicines.id JOIN members ON issues.member_id = members.id
      WHERE issues.return_date IS NULL ORDER BY issues.due_date`);
    const today = formatDate(new Date());
    res.json(result.rows.map((issue) => ({ ...issue, status: issue.due_date < today ? 'Overdue' : 'On Time' })));
  } catch (error) { next(error); }
});

// Dispenses an available medicine to a selected patient for 14 days.
router.post('/', async (req, res, next) => {
  try {
    await ready;
    const medicineResult = await db.execute({ sql: 'SELECT * FROM medicines WHERE id = ?', args: [req.body.medicine_id] });
    const memberResult = await db.execute({ sql: 'SELECT * FROM members WHERE id = ?', args: [req.body.member_id] });
    const medicine = medicineResult.rows[0];
    const member = memberResult.rows[0];
    if (!medicine || !member) return res.status(400).json({ error: 'Please select a valid medicine and patient.' });
    if (medicine.available_units <= 0) return res.status(400).json({ error: 'This medicine is currently unavailable.' });

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 14);

    const [insertResult] = await db.batch([
      {
        sql: 'INSERT INTO issues (medicine_id, member_id, issue_date, due_date) VALUES (?, ?, ?, ?)',
        args: [medicine.id, member.id, formatDate(issueDate), formatDate(dueDate)]
      },
      {
        sql: 'UPDATE medicines SET available_units = available_units - 1 WHERE id = ?',
        args: [medicine.id]
      }
    ], 'write');

    res.status(201).json({ id: Number(insertResult.lastInsertRowid), message: 'Medicine dispensed successfully.' });
  } catch (error) { next(error); }
});

// Returns a dispensed medicine, restores one unit, and calculates any late fine.
router.post('/:id/return', async (req, res, next) => {
  try {
    await ready;
    const existing = await db.execute({ sql: 'SELECT * FROM issues WHERE id = ? AND return_date IS NULL', args: [req.params.id] });
    const issue = existing.rows[0];
    if (!issue) return res.status(404).json({ error: 'Active issue not found.' });

    const returnDate = new Date();
    const dueDate = new Date(`${issue.due_date}T00:00:00`);
    const lateDays = Math.max(0, Math.ceil((returnDate - dueDate) / 86400000));
    const fine = lateDays * 5;

    await db.batch([
      {
        sql: 'UPDATE issues SET return_date = ?, fine = ? WHERE id = ?',
        args: [formatDate(returnDate), fine, issue.id]
      },
      {
        sql: 'UPDATE medicines SET available_units = available_units + 1 WHERE id = ?',
        args: [issue.medicine_id]
      }
    ], 'write');

    res.json({ message: 'Medicine returned successfully.', fine, late_days: lateDays });
  } catch (error) { next(error); }
});

module.exports = router;
