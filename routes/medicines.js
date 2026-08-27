const express = require('express');
const { db, ready } = require('../db');
const router = express.Router();

// Checks that a book has all required values and valid copy counts.
function validateBook(book) {
  const isbnIsValid = /^[0-9-]{10,17}$/.test(String(book.isbn || ''));
  if (!book.title || !book.author || !book.isbn || !book.genre || !isbnIsValid) return 'Please enter title, author, genre, and a valid ISBN.';
  if (!Number.isInteger(Number(book.total_copies)) || Number(book.total_copies) < 0) return 'Total copies must be a whole number of zero or more.';
  return null;
}

// Gets all books, optionally filtered by title or author.
router.get('/', async (req, res, next) => {
  try {
    await ready;
    const search = `%${req.query.search || ''}%`;
    const result = await db.execute({ sql: 'SELECT * FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY title', args: [search, search] });
    res.json(result.rows);
  } catch (error) { next(error); }
});

// Adds a new book to the library.
router.post('/', async (req, res, next) => {
  const error = validateBook(req.body);
  if (error) return res.status(400).json({ error });
  try {
    await ready;
    const copies = Number(req.body.total_copies);
    const result = await db.execute({
      sql: 'INSERT INTO books (title, author, isbn, genre, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?)',
      args: [req.body.title.trim(), req.body.author.trim(), req.body.isbn.trim(), req.body.genre.trim(), copies, copies]
    });
    const created = await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [result.lastInsertRowid] });
    res.status(201).json(created.rows[0]);
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) return res.status(400).json({ error: 'ISBN must be unique.' });
    next(error);
  }
});

// Updates the details and total number of copies for one book.
router.put('/:id', async (req, res, next) => {
  const error = validateBook(req.body);
  if (error) return res.status(400).json({ error });
  try {
    await ready;
    const existing = await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [req.params.id] });
    const book = existing.rows[0];
    if (!book) return res.status(404).json({ error: 'Book not found.' });
    const issuedCopies = book.total_copies - book.available_copies;
    const newTotal = Number(req.body.total_copies);
    if (newTotal < issuedCopies) return res.status(400).json({ error: `At least ${issuedCopies} copies are currently issued.` });
    await db.execute({
      sql: 'UPDATE books SET title=?, author=?, isbn=?, genre=?, total_copies=?, available_copies=? WHERE id=?',
      args: [req.body.title.trim(), req.body.author.trim(), req.body.isbn.trim(), req.body.genre.trim(), newTotal, newTotal - issuedCopies, req.params.id]
    });
    const updated = await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [req.params.id] });
    res.json(updated.rows[0]);
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) return res.status(400).json({ error: 'ISBN must be unique.' });
    next(error);
  }
});

// Deletes a book that has no active issues.
router.delete('/:id', async (req, res, next) => {
  try {
    await ready;
    const active = await db.execute({ sql: 'SELECT id FROM issues WHERE book_id = ? AND return_date IS NULL', args: [req.params.id] });
    if (active.rows[0]) return res.status(400).json({ error: 'Return this book before deleting it.' });
    const previous = await db.execute({ sql: 'SELECT id FROM issues WHERE book_id = ?', args: [req.params.id] });
    if (previous.rows[0]) return res.status(400).json({ error: 'Books with issue history cannot be deleted.' });
    const result = await db.execute({ sql: 'DELETE FROM books WHERE id = ?', args: [req.params.id] });
    if (!result.rowsAffected) return res.status(404).json({ error: 'Book not found.' });
    res.json({ message: 'Book deleted.' });
  } catch (error) { next(error); }
});

module.exports = router;
