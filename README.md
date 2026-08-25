# MediCare Pro - Medical Store Management System

A modern pharmacy and medical store management application built with HTML5, CSS3, vanilla JavaScript, Node.js, Express, and SQLite / libSQL.

## Setup & Running

1. Install [Node.js](https://nodejs.org/).
2. Open a terminal in this project folder (`medical-store`).
3. Run `npm install`.
4. Run `npm start` (or `npm run dev`).
5. Open `http://localhost:3000` in your browser.

The SQLite database file is automatically created at `medical.db` when the server first starts.

## Project Structure & File Names

- `server.js`: Express web server and REST API routing hub.
- `db.js`: Database initialization & connection to `medical.db`.
- `routes/medicines.js`: API endpoints for medicine stock inventory management (`/api/medicines`).
- `routes/patients.js`: API endpoints for patient customer directory (`/api/patients`).
- `routes/dispense.js`: API endpoints for prescription dispensing & stock returns (`/api/dispense`).
- `public/`: Web frontend user interface assets (`index.html`, `style.css`, `script.js`).
- `generate_report.py`: PDF project report compiler script.

## Sample Data

The first startup automatically seeds sample pharmaceutical medicines and patient records. To re-seed data, stop the server, delete `medical.db`, and run `npm start`.

## Features

- **Medicines & Inventory**: Add, edit, delete, search, and manage medicine stock levels, dosage, manufacturers, and barcodes.
- **Patients Directory**: Register, edit, and maintain customer profiles.
- **Prescription Dispensing & Returns**: Dispense medicines to patients, calculate 14-day refill schedules, and process returns with late surcharge calculations.
- **Healthcare Dashboard**: Real-time summary cards for total medicines, patients, active orders, and overdue refills.
