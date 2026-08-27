const express = require('express');
const { db, ready } = require('../db');
const router = express.Router();

// Checks that a medicine has all required values and valid stock quantities.
function validateMedicine(medicine) {
  const barcodeIsValid = /^[0-9-]{10,17}$/.test(String(medicine.barcode || ''));
  if (!medicine.name || !medicine.manufacturer || !medicine.barcode || !medicine.category || !barcodeIsValid) return 'Please enter the medicine name, manufacturer, category, and a valid barcode.';
  if (!Number.isInteger(Number(medicine.total_units)) || Number(medicine.total_units) < 0) return 'Total units must be a whole number of zero or more.';
  return null;
}

// Gets all medicines, optionally filtered by name or manufacturer.
router.get('/', async (req, res, next) => {
  try {
    await ready;
    const search = `%${req.query.search || ''}%`;
    const result = await db.execute({ sql: 'SELECT * FROM medicines WHERE name LIKE ? OR manufacturer LIKE ? ORDER BY name', args: [search, search] });
    res.json(result.rows);
  } catch (error) { next(error); }
});

// Adds a new medicine to inventory.
router.post('/', async (req, res, next) => {
  const error = validateMedicine(req.body);
  if (error) return res.status(400).json({ error });
  try {
    await ready;
    const units = Number(req.body.total_units);
    const result = await db.execute({
      sql: 'INSERT INTO medicines (name, manufacturer, barcode, category, total_units, available_units) VALUES (?, ?, ?, ?, ?, ?)',
      args: [req.body.name.trim(), req.body.manufacturer.trim(), req.body.barcode.trim(), req.body.category.trim(), units, units]
    });
    const created = await db.execute({ sql: 'SELECT * FROM medicines WHERE id = ?', args: [result.lastInsertRowid] });
    res.status(201).json(created.rows[0]);
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) return res.status(400).json({ error: 'Barcode must be unique.' });
    next(error);
  }
});

// Updates the details and total quantity for one medicine.
router.put('/:id', async (req, res, next) => {
  const error = validateMedicine(req.body);
  if (error) return res.status(400).json({ error });
  try {
    await ready;
    const existing = await db.execute({ sql: 'SELECT * FROM medicines WHERE id = ?', args: [req.params.id] });
    const medicine = existing.rows[0];
    if (!medicine) return res.status(404).json({ error: 'Medicine not found.' });
    const dispensedUnits = medicine.total_units - medicine.available_units;
    const newTotal = Number(req.body.total_units);
    if (newTotal < dispensedUnits) return res.status(400).json({ error: `At least ${dispensedUnits} unit(s) are currently dispensed.` });
    await db.execute({
      sql: 'UPDATE medicines SET name=?, manufacturer=?, barcode=?, category=?, total_units=?, available_units=? WHERE id=?',
      args: [req.body.name.trim(), req.body.manufacturer.trim(), req.body.barcode.trim(), req.body.category.trim(), newTotal, newTotal - dispensedUnits, req.params.id]
    });
    const updated = await db.execute({ sql: 'SELECT * FROM medicines WHERE id = ?', args: [req.params.id] });
    res.json(updated.rows[0]);
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) return res.status(400).json({ error: 'Barcode must be unique.' });
    next(error);
  }
});

// Deletes a medicine that has no dispensing history.
router.delete('/:id', async (req, res, next) => {
  try {
    await ready;
    const active = await db.execute({ sql: 'SELECT id FROM issues WHERE medicine_id = ? AND return_date IS NULL', args: [req.params.id] });
    if (active.rows[0]) return res.status(400).json({ error: 'Return this medicine before deleting it.' });
    const previous = await db.execute({ sql: 'SELECT id FROM issues WHERE medicine_id = ?', args: [req.params.id] });
    if (previous.rows[0]) return res.status(400).json({ error: 'Medicines with dispensing history cannot be deleted.' });
    const result = await db.execute({ sql: 'DELETE FROM medicines WHERE id = ?', args: [req.params.id] });
    if (!result.rowsAffected) return res.status(404).json({ error: 'Medicine not found.' });
    res.json({ message: 'Medicine deleted.' });
  } catch (error) { next(error); }
});

module.exports = router;
