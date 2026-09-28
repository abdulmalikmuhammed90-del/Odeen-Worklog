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
const passwordInput = document.querySelector('#password');
const passwordToggle = document.querySelector('#toggle-password');
const form = document.querySelector('#work-form');
const recordsBody = document.querySelector('#records-body');
const searchInput = document.querySelector('#search');
const dateFilter = document.querySelector('#filter-date');
const statusFilter = document.querySelector('#filter-status');
const managerWeeklyPanel = document.querySelector('#manager-weekly-panel');
const managerClientName = document.querySelector('#manager-client-name');
const managerOrderCount = document.querySelector('#manager-order-count');
const managerWeeklyForm = document.querySelector('#manager-weekly-form');
const managerWeekInput = document.querySelector('#manager-week');
const pieceworkRates = { Trouser: 1500, Top: 2000, Cap: 500 };
const nairaFormat = new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 0
});
let records = [];
let managerWeeklyLogs = [];
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

function weekStart(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return localDateString(date);
}

function weekEnd(start) {
  const endDate = new Date(`${start}T12:00:00`);
  endDate.setDate(endDate.getDate() + 6);
  return localDateString(endDate);
}

function renderManagerWeeklyLogs() {
  const body = document.querySelector('#manager-weekly-body');
  body.replaceChildren();
  let currentWeek = '';
  let weekEntryNumber = 0;
  managerWeeklyLogs.forEach(log => {
    if (log.week_start !== currentWeek) {
      currentWeek = log.week_start;
      weekEntryNumber = 1;
    } else {
      weekEntryNumber += 1;
    }
    const row = document.createElement('tr');
    addCell(row, 'week-label', `${formatDate(log.week_start)} – ${formatDate(weekEnd(log.week_start))}`);
    addCell(row, 'manager-sequence', String(weekEntryNumber));
    addCell(row, '', log.client_name);
    addCell(row, 'manager-qty-value', Number(log.order_count).toLocaleString());
    addCell(row, '', new Date(log.updated_at).toLocaleString('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }));
    const actionCell = document.createElement('td');
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'delete-button';
    clearButton.textContent = '×';
    clearButton.title = 'Clear saved log';
    clearButton.setAttribute('aria-label', `Clear saved log for ${log.client_name}, week of ${formatDate(log.week_start)}`);
    clearButton.addEventListener('click', () => deleteManagerWeeklyLog(log.id, log.client_name, log.week_start));
    actionCell.append(clearButton);
    row.append(actionCell);
    body.append(row);
  });
  document.querySelector('#manager-weekly-empty').classList.toggle('hidden', managerWeeklyLogs.length > 0);
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

async function loadManagerWeeklyLogs() {
  const { data, error } = await db.from('weekly_client_orders')
    .select('id, week_start, client_name, order_count, updated_at')
    .order('week_start', { ascending: false })
    .order('client_name', { ascending: true });
  if (error) throw error;
  managerWeeklyLogs = data;
  renderManagerWeeklyLogs();
}

function renderWorkRecordTotals(visibleRecords) {
  const totalsPanel = document.querySelector('#work-record-totals');
  const totalsBody = document.querySelector('#work-record-totals-body');
  totalsBody.replaceChildren();

  const totalsByStaff = new Map();
  visibleRecords.forEach(record => {
    if (!totalsByStaff.has(record.staff)) totalsByStaff.set(record.staff, 0);
    const rate = pieceworkRates[record.category];
    if (!rate) return;
    totalsByStaff.set(record.staff, totalsByStaff.get(record.staff) + rate * Number(record.quantity || 0));
  });

  const sortedTotals = [...totalsByStaff.entries()].sort(([a], [b]) => a.localeCompare(b));
  sortedTotals.forEach(([staff, total]) => {
    const row = document.createElement('tr');
    addCell(row, '', staff);
    addCell(row, 'value-cell', nairaFormat.format(total));
    totalsBody.append(row);
  });

  if (profile?.role?.toLowerCase() === 'manager' && sortedTotals.length > 0) {
    const grandTotal = sortedTotals.reduce((sum, [, total]) => sum + total, 0);
    const totalRow = document.createElement('tr');
    totalRow.className = 'work-record-grand-total';
    addCell(totalRow, '', 'ALL USERS TOTAL');
    addCell(totalRow, 'value-cell', nairaFormat.format(grandTotal));
    totalsBody.append(totalRow);
  }

  totalsPanel.classList.toggle('hidden', totalsByStaff.size === 0);
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
  renderWorkRecordTotals(visibleRecords);
}

async function showSignedInWorkspace(session) {
  const thisRun = ++sessionRun;
  if (!session) {
    profile = null;
    records = [];
    managerWeeklyLogs = [];
    managerWeeklyPanel.classList.add('hidden');
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
    const isManager = profile.role?.toLowerCase() === 'manager';
    appShell.classList.toggle('manager-mode', isManager);
    document.querySelector('#staff-metrics').classList.toggle('hidden', isManager);
    managerWeeklyPanel.classList.toggle('hidden', !isManager);
    managerWeeklyLogs = [];
    renderManagerWeeklyLogs();
    if (isManager) {
      managerWeekInput.value = weekStart(localDateString());
      managerClientName.value = '';
      managerOrderCount.value = '';
    }
    document.querySelector('#staff').value = profile.display_name;
    document.querySelector('#account-label').textContent = `${profile.display_name} · ${profile.role.toUpperCase()}`;
    if (profile.department && [...document.querySelector('#department').options].some(option => option.value === profile.department || option.text === profile.department)) {
      document.querySelector('#department').value = profile.department;
    }
    await loadRecords();
    if (isManager) {
      try {
        await loadManagerWeeklyLogs();
      } catch (error) {
        showToast(`Could not load weekly management records: ${error.message}`, true);
      }
    }
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

async function deleteManagerWeeklyLog(id, clientName, weekStartDate) {
  const week = formatDate(weekStartDate);
  if (!window.confirm(`Clear the saved order log for ${clientName} for the week of ${week}? This cannot be undone.`)) return;
  const { error } = await db.from('weekly_client_orders').delete().eq('id', id);
  if (error) return showToast(`Could not clear saved log: ${error.message}`, true);
  try {
    await loadManagerWeeklyLogs();
    showToast('Saved client order log cleared.');
  } catch (error) {
    showToast(`Cleared, but the register could not refresh: ${error.message}`, true);
  }
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

passwordToggle.addEventListener('click', () => {
  const isVisible = passwordInput.type === 'password';
  passwordInput.type = isVisible ? 'text' : 'password';
  passwordToggle.textContent = isVisible ? 'Hide' : 'Show';
  passwordToggle.setAttribute('aria-label', `${isVisible ? 'Hide' : 'Show'} password`);
  passwordToggle.setAttribute('aria-pressed', String(isVisible));
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

managerWeekInput.addEventListener('change', () => {
  if (!managerWeekInput.value) return;
  managerWeekInput.value = weekStart(managerWeekInput.value);
});

managerWeeklyForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (profile?.role?.toLowerCase() !== 'manager') return showToast('Only managers can save weekly management records.', true);
  const week = weekStart(managerWeekInput.value);
  const clientName = managerClientName.value.trim();
  const orderCount = Number(managerOrderCount.value);
  if (!managerWeekInput.value || !clientName || !Number.isInteger(orderCount) || orderCount < 1) {
    return showToast('Choose a week, enter a client name, and enter at least one order.', true);
  }

  const existingLog = managerWeeklyLogs.find(log => log.week_start === week && log.client_name.trim().toLowerCase() === clientName.toLowerCase());
  const weeklyLog = {
    ...(existingLog ? { id: existingLog.id } : {}),
    week_start: week,
    client_name: clientName,
    order_count: orderCount,
    updated_by: profile.id,
    updated_at: new Date().toISOString()
  };

  const saveButton = managerWeeklyForm.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  const { error } = await db.from('weekly_client_orders').upsert(weeklyLog, { onConflict: 'id' });
  saveButton.disabled = false;
  if (error) return showToast(`Could not save weekly record: ${error.message}`, true);

  managerClientName.value = '';
  managerOrderCount.value = '';
  try {
    await loadManagerWeeklyLogs();
    showToast(existingLog ? 'Client order log updated.' : 'Client order log saved.');
  } catch (error) {
    showToast(`Saved, but the weekly record list could not refresh: ${error.message}`, true);
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
