import * as FileSystem from 'expo-file-system/legacy';

const FILE = `${FileSystem.documentDirectory || ''}umb-reminders.json`;

function emailKey(email) {
  return String(email || '').trim().toLowerCase();
}

async function loadAll() {
  try {
    if (!FileSystem.documentDirectory) return {};
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(FILE);
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export async function loadReminders(email) {
  const all = await loadAll();
  const list = all[emailKey(email)];
  return Array.isArray(list) ? list : [];
}

export async function saveReminders(email, list) {
  if (!FileSystem.documentDirectory) return;
  const key = emailKey(email);
  if (!key) return;
  const all = await loadAll();
  all[key] = Array.isArray(list) ? list : [];
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(all));
}

export function reminderDates(reminder) {
  if (Array.isArray(reminder?.dates) && reminder.dates.length) {
    return [...new Set(reminder.dates.map(String))].sort();
  }
  if (reminder?.date) return [String(reminder.date)];
  return [];
}

export function reminderDateTime(reminder, dateIso) {
  const date = dateIso || reminderDates(reminder)[0] || reminder?.date;
  const [y, m, d] = String(date || '').split('-').map(Number);
  const [hh, mm] = String(reminder?.time || '00:00').split(':').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function reminderOccurrences(reminder) {
  return reminderDates(reminder)
    .map((date) => ({ date, when: reminderDateTime(reminder, date) }))
    .filter((o) => o.when);
}

export function nextOccurrence(reminder) {
  const now = Date.now();
  const future = reminderOccurrences(reminder).filter((o) => o.when.getTime() > now);
  if (future.length) return future[0];
  const all = reminderOccurrences(reminder);
  return all.length ? all[all.length - 1] : null;
}

export function reminderIsPast(reminder) {
  const occ = reminderOccurrences(reminder);
  if (!occ.length) return false;
  return occ.every((o) => o.when.getTime() < Date.now());
}

export function reminderIsDue(reminder) {
  return reminderOccurrences(reminder).some((o) => o.when.getTime() <= Date.now());
}

export function dateToDayKey(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const n = new Date(y, m - 1, d).getDay();
  return n === 0 ? 'SUNDAY'
    : n === 1 ? 'MONDAY'
    : n === 2 ? 'TUESDAY'
    : n === 3 ? 'WEDNESDAY'
    : n === 4 ? 'THURSDAY'
    : n === 5 ? 'FRIDAY'
    : 'SATURDAY';
}

export function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
