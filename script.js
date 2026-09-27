// The records are stored in this browser, under this key in localStorage.
const STORAGE_KEY = 'odeenWorkRecords';

const form = document.querySelector('#work-form');
const recordsBody = document.querySelector('#records-body');
const searchInput = document.querySelector('#search');
const dateFilter = document.querySelector('#filter-date');
const statusFilter = document.querySelector('#filter-status');
let records = loadRecords();
let toastTimer;

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// Use textContent for staff-entered values so text is shown safely, not treated as HTML.
function addCell(row, className, value) {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = value;
  row.append(cell);
  return cell;
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
}

function renderRecords() {
  const query = searchInput.value.trim().toLowerCase();
  const chosenDate = dateFilter.value;
  const chosenStatus = statusFilter.value;
  const visibleRecords = records.filter(record => {
    const searchable = `${record.staff} ${record.department} ${record.category} ${record.description} ${record.notes}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!chosenDate || record.date === chosenDate) && (!chosenStatus || record.status === chosenStatus);
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  recordsBody.replaceChildren();
  visibleRecords.forEach(record => {
    const row = document.createElement('tr');
    const staffCell = document.createElement('td');
    const staffWrap = document.createElement('div'); staffWrap.className = 'staff-cell';
    const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = initials(record.staff);
    const info = document.createElement('span'); info.className = 'staff-info';
    const name = document.createElement('strong'); name.textContent = record.staff;
    const role = document.createElement('small'); role.textContent = record.department;
    info.append(name, role); staffWrap.append(avatar, info); staffCell.append(staffWrap); row.append(staffCell);
    addCell(row, '', formatDate(record.date));
    addCell(row, 'category-label', record.category);
    const workCell = addCell(row, 'work-cell', record.description);
    if (record.notes) workCell.title = record.notes;
    addCell(row, 'qty-cell', String(record.quantity));
    const badgeCell = document.createElement('td');
    const badge = document.createElement('span'); badge.className = `badge ${record.status === 'Completed' ? 'completed' : 'progress'}`; badge.textContent = record.status;
    badgeCell.append(badge); row.append(badgeCell);
    const actionCell = document.createElement('td');
    const removeButton = document.createElement('button'); removeButton.type = 'button'; removeButton.className = 'delete-button'; removeButton.textContent = '×'; removeButton.setAttribute('aria-label', `Delete record for ${record.staff}`);
    removeButton.addEventListener('click', () => deleteRecord(record.id)); actionCell.append(removeButton); row.append(actionCell);
    recordsBody.append(row);
  });

  document.querySelector('#total-count').textContent = records.length;
  document.querySelector('#completed-count').textContent = records.filter(record => record.status === 'Completed').length;
  document.querySelector('#progress-count').textContent = records.filter(record => record.status === 'In Progress').length;
  document.querySelector('#units-count').textContent = records.reduce((sum, record) => sum + Number(record.quantity || 0), 0).toLocaleString();
  document.querySelector('#nav-count').textContent = records.length;
  document.querySelector('#visible-count').textContent = visibleRecords.length;
  document.querySelector('#empty-state').classList.toggle('hidden', records.length > 0);
  document.querySelector('#no-results').classList.toggle('hidden', records.length === 0 || visibleRecords.length > 0);
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function deleteRecord(id) {
  records = records.filter(record => record.id !== id);
  saveRecords();
  renderRecords();
  showToast('Work record deleted.');
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    createdAt: Date.now(),
    staff: data.get('staff').trim(),
    date: data.get('date'),
    department: data.get('department'),
    category: data.get('category'),
    description: data.get('description').trim(),
    quantity: Number(data.get('quantity')),
    status: data.get('status'),
    notes: data.get('notes').trim()
  };
  records.push(record);
  saveRecords();
  form.reset();
  document.querySelector('#date').value = localDateString();
  renderRecords();
  showToast('Work record saved on this device.');
});

[searchInput, dateFilter, statusFilter].forEach(control => control.addEventListener('input', renderRecords));
document.querySelector('#clear-filters').addEventListener('click', () => {
  searchInput.value = '';
  dateFilter.value = '';
  statusFilter.value = '';
  renderRecords();
});

document.querySelector('#date').value = localDateString();
document.querySelector('#today-display').textContent = new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
document.querySelector('#year').textContent = new Date().getFullYear();
renderRecords();
