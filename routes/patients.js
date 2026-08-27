const express = require('express');
const { db, ready } = require('../db');
const router = express.Router();

// Checks that a member has required details and a valid email address.
function validateMember(member) {
  if (!member.name || !member.email || !member.phone || !member.membership_date) return 'Please complete all member fields.';
  if (!/^\S+@\S+\.\S+$/.test(member.email)) return 'Please enter a valid email address.';
  return null;
}

// Gets every registered member.
router.get('/', async (req, res, next) => {
  try {
    await ready;
    const result = await db.execute('SELECT * FROM members ORDER BY name');
    res.json(result.rows);
  } catch (error) { next(error); }
});

// Adds a member to the database.
router.post('/', async (req, res, next) => {
  const error = validateMember(req.body);
  if (error) return res.status(400).json({ error });
  try {
    await ready;
    const result = await db.execute({
      sql: 'INSERT INTO members (name, email, phone, membership_date) VALUES (?, ?, ?, ?)',
      args: [req.body.name.trim(), req.body.email.trim(), req.body.phone.trim(), req.body.membership_date]
    });
    const created = await db.execute({ sql: 'SELECT * FROM members WHERE id = ?', args: [result.lastInsertRowid] });
    res.status(201).json(created.rows[0]);
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) return res.status(400).json({ error: 'Email must be unique.' });
    next(error);
  }
});

// Updates one member's details.
router.put('/:id', async (req, res, next) => {
  const error = validateMember(req.body);
  if (error) return res.status(400).json({ error });
  try {
    await ready;
    const result = await db.execute({
      sql: 'UPDATE members SET name=?, email=?, phone=?, membership_date=? WHERE id=?',
      args: [req.body.name.trim(), req.body.email.trim(), req.body.phone.trim(), req.body.membership_date, req.params.id]
    });
    if (!result.rowsAffected) return res.status(404).json({ error: 'Member not found.' });
    const updated = await db.execute({ sql: 'SELECT * FROM members WHERE id = ?', args: [req.params.id] });
    res.json(updated.rows[0]);
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) return res.status(400).json({ error: 'Email must be unique.' });
    next(error);
  }
});

// Deletes a member who has no active book issues.
router.delete('/:id', async (req, res, next) => {
  try {
    await ready;
    const active = await db.execute({ sql: 'SELECT id FROM issues WHERE member_id = ? AND return_date IS NULL', args: [req.params.id] });
    if (active.rows[0]) return res.status(400).json({ error: 'Return this member\'s book before deleting them.' });
    const previous = await db.execute({ sql: 'SELECT id FROM issues WHERE member_id = ?', args: [req.params.id] });
    if (previous.rows[0]) return res.status(400).json({ error: 'Members with issue history cannot be deleted.' });
    const result = await db.execute({ sql: 'DELETE FROM members WHERE id = ?', args: [req.params.id] });
    if (!result.rowsAffected) return res.status(404).json({ error: 'Member not found.' });
    res.json({ message: 'Member deleted.' });
  } catch (error) { next(error); }
});

module.exports = router;
