const api = '/api';

// Shows a short success or error message above the current section.
function showMessage(message, isError = false) {
  const messageBox = document.getElementById('message');
  messageBox.textContent = message;
  messageBox.className = isError ? 'error' : 'success';
  setTimeout(() => { messageBox.textContent = ''; messageBox.className = ''; }, 4500);
}

// Sends a request and turns an API error into a normal JavaScript error.
async function request(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// Escapes text before putting it inside table HTML.
function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (letter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[letter]);
}

// Loads the four summary numbers on the dashboard.
async function loadDashboard() {
  try {
    const data = await request(`${api}/dashboard`);
    document.getElementById('totalBooks').textContent = data.totalMedicines || data.totalBooks;
    document.getElementById('totalMembers').textContent = data.totalPatients || data.totalMembers;
    document.getElementById('totalIssued').textContent = data.totalDispensed || data.totalIssued;
    document.getElementById('totalOverdue').textContent = data.totalOverdueRefills || data.totalOverdue;
  } catch (error) { showMessage(error.message, true); }
}

// Loads medicines and displays them in the inventory table.
async function loadBooks() {
  try {
    const search = document.getElementById('bookSearch').value;
    const books = await request(`${api}/medicines?search=${encodeURIComponent(search)}`);
    window.books = books;
    const actions = (book) => `
      <button class="small" onclick="showBookForm(${book.id})">Edit</button>
      <button class="small danger" onclick="deleteBook(${book.id})">Delete</button>
    `;
    document.getElementById('booksList').innerHTML = books.map((book) => `
      <tr>
        <td data-label="Medicine Name"><strong>${escapeHtml(book.title)}</strong></td>
        <td data-label="Manufacturer / Brand">${escapeHtml(book.author)}</td>
        <td data-label="Barcode / Batch Code"><code>${escapeHtml(book.isbn)}</code></td>
        <td data-label="Category"><span class="badge-category">${escapeHtml(book.genre)}</span></td>
        <td data-label="Stock Level"><span class="badge-stock ${book.available_copies === 0 ? 'low-stock' : ''}">${book.available_copies} / ${book.total_copies} units</span></td>
        <td data-label="Actions" class="actions-cell">${actions(book)}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--muted);">No medicine products found in inventory.</td></tr>';
  } catch (error) { showMessage(error.message, true); }
}

// Shows the add or edit medicine form.
function showBookForm(id) {
  const book = id ? window.books.find((item) => item.id === id) : { title: '', author: '', isbn: '', genre: 'General', total_copies: 10 };
  document.getElementById('bookForm').classList.remove('hidden');
  document.getElementById('bookForm').innerHTML = `
    <h3>${id ? 'Edit' : 'Add New'} Medicine Product</h3>
    <form onsubmit="saveBook(event, ${id || 'null'})">
      <label>Medicine Name
        <input name="title" required placeholder="e.g. Paracetamol 500mg" value="${escapeHtml(book.title)}">
      </label>
      <label>Manufacturer / Brand
        <input name="author" required placeholder="e.g. GlaxoSmithKline" value="${escapeHtml(book.author)}">
      </label>
      <label>Barcode / Batch Code (10-17 digits)
        <input name="isbn" pattern="[0-9-]{10,17}" required placeholder="e.g. 8901234567890" value="${escapeHtml(book.isbn)}">
      </label>
      <label>Drug Category
        <input name="genre" required placeholder="e.g. Analgesic, Antibiotic" value="${escapeHtml(book.genre)}">
      </label>
      <label>Total Units in Stock
        <input name="total_copies" type="number" min="0" required value="${book.total_copies}">
      </label>
      <div style="width: 100%; display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
        <button class="btn-primary">Save Medicine Product</button>
        <button type="button" class="secondary" onclick="hideForm('bookForm')">Cancel</button>
      </div>
    </form>
  `;
}

// Adds a new medicine or saves edits to an existing medicine.
async function saveBook(event, id) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    await request(`${api}/medicines${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    hideForm('bookForm');
    showMessage(`Medicine product ${id ? 'updated' : 'added'} successfully.`);
    loadBooks(); loadDashboard(); loadIssueChoices();
  } catch (error) { showMessage(error.message, true); }
}

// Deletes one medicine after asking for confirmation.
async function deleteBook(id) {
  if (!confirm('Delete this medicine product from store inventory?')) return;
  try {
    await request(`${api}/medicines/${id}`, { method: 'DELETE' });
    showMessage('Medicine product deleted.');
    loadBooks(); loadDashboard(); loadIssueChoices();
  } catch (error) { showMessage(error.message, true); }
}

// Loads patients and displays them in the patients table.
async function loadMembers() {
  try {
    const members = await request(`${api}/patients`);
    window.members = members;
    document.getElementById('membersList').innerHTML = members.map((member) => `
      <tr>
        <td data-label="Patient Name"><strong>${escapeHtml(member.name)}</strong></td>
        <td data-label="Email Address">${escapeHtml(member.email)}</td>
        <td data-label="Phone Number">${escapeHtml(member.phone)}</td>
        <td data-label="Registration Date">${member.membership_date}</td>
        <td data-label="Actions" class="actions-cell">
          <button class="small" onclick="showMemberForm(${member.id})">Edit</button>
          <button class="small danger" onclick="deleteMember(${member.id})">Delete</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--muted);">No registered patients found.</td></tr>';
  } catch (error) { showMessage(error.message, true); }
}

// Shows the add or edit patient form.
function showMemberForm(id) {
  const member = id ? window.members.find((item) => item.id === id) : { name: '', email: '', phone: '', membership_date: new Date().toISOString().split('T')[0] };
  document.getElementById('memberForm').classList.remove('hidden');
  document.getElementById('memberForm').innerHTML = `
    <h3>${id ? 'Edit' : 'Register New'} Patient Profile</h3>
    <form onsubmit="saveMember(event, ${id || 'null'})">
      <label>Patient Full Name
        <input name="name" required placeholder="e.g. Aarav Sharma" value="${escapeHtml(member.name)}">
      </label>
      <label>Email Address
        <input name="email" type="email" required placeholder="patient@example.com" value="${escapeHtml(member.email)}">
      </label>
      <label>Phone Number
        <input name="phone" required placeholder="e.g. 9876543210" value="${escapeHtml(member.phone)}">
      </label>
      <label>Registration Date
        <input name="membership_date" type="date" required value="${member.membership_date}">
      </label>
      <div style="width: 100%; display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
        <button class="btn-primary">Save Patient Profile</button>
        <button type="button" class="secondary" onclick="hideForm('memberForm')">Cancel</button>
      </div>
    </form>
  `;
}

// Adds a new patient or saves edits to an existing patient.
async function saveMember(event, id) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    await request(`${api}/patients${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    hideForm('memberForm');
    showMessage(`Patient profile ${id ? 'updated' : 'registered'} successfully.`);
    loadMembers(); loadDashboard(); loadIssueChoices();
  } catch (error) { showMessage(error.message, true); }
}

// Deletes one patient after asking for confirmation.
async function deleteMember(id) {
  if (!confirm('Delete this patient profile?')) return;
  try {
    await request(`${api}/patients/${id}`, { method: 'DELETE' });
    showMessage('Patient profile deleted.');
    loadMembers(); loadDashboard(); loadIssueChoices();
  } catch (error) { showMessage(error.message, true); }
}

// Loads active dispensed prescriptions and displays their status.
async function loadIssues() {
  try {
    const issues = await request(`${api}/dispense`);
    const returnButton = (issue) => `<button class="small" onclick="returnBook(${issue.id})">Return Stock / Refill</button>`;
    document.getElementById('issuesList').innerHTML = issues.map((issue) => `
      <tr>
        <td data-label="Patient"><strong>${escapeHtml(issue.member_name)}</strong></td>
        <td data-label="Medicine">${escapeHtml(issue.book_title)}</td>
        <td data-label="Dispensed Date">${issue.issue_date}</td>
        <td data-label="Refill Due">${issue.due_date}</td>
        <td data-label="Status"><span class="status ${issue.status === 'Overdue' ? 'overdue' : ''}">${issue.status === 'Overdue' ? 'Refill Overdue' : 'On Schedule'}</span></td>
        <td data-label="Action" class="actions-cell">${returnButton(issue)}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--muted);">No active dispensed medicines currently logged.</td></tr>';
  } catch (error) { showMessage(error.message, true); }
}

// Fills the dispense form with available medicines and all patients.
async function loadIssueChoices() {
  try {
    const [books, members] = await Promise.all([request(`${api}/medicines`), request(`${api}/patients`)]);
    document.getElementById('issueBook').innerHTML = '<option value="">Select a medicine product</option>' + books.filter((book) => book.available_copies > 0).map((book) => `<option value="${book.id}">${escapeHtml(book.title)} (${book.available_copies} units available)</option>`).join('');
    document.getElementById('issueMember').innerHTML = '<option value="">Select a registered patient</option>' + members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)} (${member.phone})</option>`).join('');
  } catch (error) { showMessage(error.message, true); }
}

// Dispenses selected medicine to selected patient.
async function issueBook(event) {
  event.preventDefault();
  try {
    await request(`${api}/dispense`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ book_id: document.getElementById('issueBook').value, member_id: document.getElementById('issueMember').value }) });
    showMessage('Medicine dispensed successfully. Refill/return due in 14 days.');
    event.target.reset();
    refreshAll();
  } catch (error) { showMessage(error.message, true); }
}

// Returns a dispensed medicine stock and displays any calculated late surcharge.
async function returnBook(id) {
  try {
    const result = await request(`${api}/dispense/${id}/return`, { method: 'POST' });
    showMessage(result.fine ? `Stock returned to inventory. Late Surcharge: ₹${result.fine} for ${result.late_days} overdue day(s).` : 'Stock returned to inventory. No late surcharge.');
    refreshAll();
  } catch (error) { showMessage(error.message, true); }
}

// Hides a form box.
function hideForm(id) { document.getElementById(id).classList.add('hidden'); }

// Refreshes every section after a medicine dispense or return.
function refreshAll() { loadDashboard(); loadBooks(); loadMembers(); loadIssues(); loadIssueChoices(); }

// Switches visible sections when a navigation button is clicked.
function setupNavigation() {
  document.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.nav-button, .section').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll(`[data-section="${button.dataset.section}"]`).forEach((btn) => btn.classList.add('active'));
    document.getElementById(button.dataset.section).classList.add('active');
  }));
}

// Starts the page by loading data and adding event listeners.
function startApp() {
  setupNavigation();
  const dateChip = document.getElementById('currentDateChip');
  if (dateChip) {
    const now = new Date();
    dateChip.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  document.getElementById('issueForm').addEventListener('submit', issueBook);
  refreshAll();
}

startApp();
