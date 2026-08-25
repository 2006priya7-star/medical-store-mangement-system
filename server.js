const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, ready } = require('./db');
const medicinesRouter = require('./routes/medicines');
const patientsRouter = require('./routes/patients');
const dispenseRouter = require('./routes/dispense');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/medicines', medicinesRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/dispense', dispenseRouter);

// Fallback legacy routes for compatibility
app.use('/api/books', medicinesRouter);
app.use('/api/members', patientsRouter);
app.use('/api/issues', dispenseRouter);

// Gets the summary numbers displayed on the dashboard cards.
app.get('/api/dashboard', async (req, res, next) => {
  try {
    await ready;
    const today = new Date().toISOString().split('T')[0];
    const [medicines, patients, dispensed, overdue] = await db.batch([
      'SELECT COALESCE(SUM(total_copies), 0) AS total FROM books',
      'SELECT COUNT(*) AS total FROM members',
      'SELECT COUNT(*) AS total FROM issues WHERE return_date IS NULL',
      { sql: 'SELECT COUNT(*) AS total FROM issues WHERE return_date IS NULL AND due_date < ?', args: [today] }
    ]);
    res.json({
      totalBooks: medicines.rows[0].total,
      totalMembers: patients.rows[0].total,
      totalIssued: dispensed.rows[0].total,
      totalOverdue: overdue.rows[0].total,
      totalMedicines: medicines.rows[0].total,
      totalPatients: patients.rows[0].total,
      totalDispensed: dispensed.rows[0].total,
      totalOverdueRefills: overdue.rows[0].total
    });
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Unable to complete the request. Check the database configuration.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`MediCare Medical Store app running at http://localhost:${PORT}`));
}

module.exports = app;
