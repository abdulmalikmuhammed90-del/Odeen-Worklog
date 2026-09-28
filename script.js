// Supabase Auth supplies the signed-in identity; Postgres RLS limits visible rows.
const config = window.ODEEN_SUPABASE_CONFIG;
if (!config?.url || !config?.publishableKey || !window.supabase?.createClient) {
  throw new Error('Supabase setup is incomplete. Check the client script and supabase-config.js.');
}

const db = window.supabase.createClient(config.url, config.publishableKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});
const authView = document.querySelector('#auth-view');
const appShell = document.querySelector('#app-shell');
const signInForm = document.querySelector('#sign-in-form');
const authMessage = document.querySelector('#auth-message');
const form = document.querySelector('#work-form');
const recordsBody = document.querySelector('#records-body');
const searchInput = document.querySelector('#search');
const dateFilter = document.querySelector('#filter-date');
const statusFilter = document.querySelector('#filter-status');
let records = [];
let profile = null;
let toastTimer;
let sessionRun = 0;

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

function showToast(message, isError = false) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.toggle('toast-error', isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function setAuthMessage(message, isSuccess = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle('success', isSuccess);
}

async function getProfile(userId) {
  const { data, error } = await db.from('profiles')
    .select('id, display_name, department, role')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function loadRecords() {
  const { data, error } = await db.from('work_records')
    .select('id, staff_id, staff_name, work_date, department, category, description, quantity, status, notes, created_at')
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  records = data.map(record => ({
    id: record.id,
    staff: record.staff_name,
    date: record.work_date,
    department: record.department,
    category: record.category,
    description: record.description,
    quantity: record.quantity,
    status: record.status,
    notes: record.notes,
    createdAt: record.created_at
  }));
  renderRecords();
}

function renderRecords() {
  const query = searchInput.value.trim().toLowerCase();
  const chosenDate = dateFilter.value;
  const chosenStatus = statusFilter.value;
  const visibleRecords = records.filter(record => {
    const searchable = `${record.staff} ${record.department} ${record.category} ${record.description} ${record.notes}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!chosenDate || record.date === chosenDate) && (!chosenStatus || record.status === chosenStatus);
  }).sort((a, b) => b.date.localeCompare(a.date) || new Date(b.createdAt) - new Date(a.createdAt));

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

async function showSignedInWorkspace(session) {
  const thisRun = ++sessionRun;
  if (!session) {
    profile = null;
    records = [];
    appShell.classList.add('hidden');
    authView.classList.remove('hidden');
    return;
  }

  try {
    const signedInProfile = await getProfile(session.user.id);
    if (thisRun !== sessionRun) return;
    profile = signedInProfile;
    authView.classList.add('hidden');
    appShell.classList.remove('hidden');
    document.querySelector('#staff').value = profile.display_name;
    document.querySelector('#account-label').textContent = `${profile.display_name} · ${profile.role.toUpperCase()}`;
    if (profile.department && [...document.querySelector('#department').options].some(option => option.value === profile.department || option.text === profile.department)) {
      document.querySelector('#department').value = profile.department;
    }
    await loadRecords();
  } catch (error) {
    if (thisRun !== sessionRun) return;
    await db.auth.signOut();
    appShell.classList.add('hidden');
    authView.classList.remove('hidden');
    setAuthMessage(`Could not load your profile or records: ${error.message}`);
  }
}

async function deleteRecord(id) {
  if (!window.confirm('Delete this work record? This cannot be undone.')) return;
  const { error } = await db.from('work_records').delete().eq('id', id);
  if (error) return showToast(`Could not delete record: ${error.message}`, true);
  await loadRecords();
  showToast('Work record deleted.');
}

signInForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submitButton = signInForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setAuthMessage('Signing in…', true);
  const data = new FormData(signInForm);
  const { data: result, error } = await db.auth.signInWithPassword({
    email: data.get('email').trim(),
    password: data.get('password')
  });
  submitButton.disabled = false;
  if (error) return setAuthMessage(error.message);
  signInForm.reset();
  setAuthMessage('Signed in.', true);
  await showSignedInWorkspace(result.session);
});

document.querySelector('#sign-out').addEventListener('click', async () => {
  const { error } = await db.auth.signOut();
  if (error) showToast(`Could not sign out: ${error.message}`, true);
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!profile) return showToast('Sign in before saving a record.', true);
  const data = new FormData(form);
  const record = {
    work_date: data.get('date'),
    department: data.get('department'),
    category: data.get('category'),
    description: data.get('description').trim(),
    quantity: Number(data.get('quantity')),
    status: data.get('status'),
    notes: data.get('notes').trim()
  };
  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  const { error } = await db.from('work_records').insert(record);
  saveButton.disabled = false;
  if (error) return showToast(`Could not save record: ${error.message}`, true);
  form.reset();
  document.querySelector('#staff').value = profile.display_name;
  document.querySelector('#date').value = localDateString();
  if (profile.department && [...document.querySelector('#department').options].some(option => option.value === profile.department || option.text === profile.department)) {
    document.querySelector('#department').value = profile.department;
  }
  try {
    await loadRecords();
    showToast('Work record saved to the shared log.');
  } catch (error) {
    showToast(`Saved, but the list could not refresh: ${error.message}`, true);
  }
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

db.auth.onAuthStateChange((event, session) => {
  if (event !== 'INITIAL_SESSION') void showSignedInWorkspace(session);
});
db.auth.getSession().then(({ data, error }) => {
  if (error) setAuthMessage(`Could not check sign-in status: ${error.message}`);
  else void showSignedInWorkspace(data.session);
});
