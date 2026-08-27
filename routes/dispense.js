const express = require('express');
const { db, ready } = require('../db');
const router = express.Router();

// Formats a date as YYYY-MM-DD for storing in the database.
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Gets all active issues with the book and member names.
router.get('/', async (req, res, next) => {
  try {
    await ready;
    const result = await db.execute(`SELECT issues.*, books.title AS book_title, members.name AS member_name
      FROM issues JOIN books ON issues.book_id = books.id JOIN members ON issues.member_id = members.id
      WHERE issues.return_date IS NULL ORDER BY issues.due_date`);
    const today = formatDate(new Date());
    res.json(result.rows.map((issue) => ({ ...issue, status: issue.due_date < today ? 'Overdue' : 'On Time' })));
  } catch (error) { next(error); }
});

// Issues an available book to a selected member for 14 days.
router.post('/', async (req, res, next) => {
  try {
    await ready;
    const bookResult = await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [req.body.book_id] });
    const memberResult = await db.execute({ sql: 'SELECT * FROM members WHERE id = ?', args: [req.body.member_id] });
    const book = bookResult.rows[0];
    const member = memberResult.rows[0];
    if (!book || !member) return res.status(400).json({ error: 'Please select a valid book and member.' });
    if (book.available_copies <= 0) return res.status(400).json({ error: 'This book is currently unavailable.' });

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 14);

    const [insertResult] = await db.batch([
      {
        sql: 'INSERT INTO issues (book_id, member_id, issue_date, due_date) VALUES (?, ?, ?, ?)',
        args: [book.id, member.id, formatDate(issueDate), formatDate(dueDate)]
      },
      {
        sql: 'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?',
        args: [book.id]
      }
    ], 'write');

    res.status(201).json({ id: Number(insertResult.lastInsertRowid), message: 'Book issued successfully.' });
  } catch (error) { next(error); }
});

// Returns an issued book, restores a copy, and calculates any late fine.
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
        sql: 'UPDATE books SET available_copies = available_copies + 1 WHERE id = ?',
        args: [issue.book_id]
      }
    ], 'write');

    res.json({ message: 'Book returned successfully.', fine, late_days: lateDays });
  } catch (error) { next(error); }
});

module.exports = router;
