import * as FileSystem from 'expo-file-system/legacy';
import { COLORS } from '../ui/theme';

const FILE = `${FileSystem.documentDirectory || ''}umb-class-colors.json`;

export const CLASS_COLOR_OPTIONS = [
  '#B91C1C',
  '#1E40AF',
  '#0F766E',
  '#15803D',
  '#C2410C',
  '#7C3AED',
  '#0E7490',
  '#BE185D',
  '#4338CA',
  '#4B5563',
];

function emailKey(email) {
  return String(email || '').trim().toLowerCase();
}

function classKey(classId) {
  return String(classId || '').trim();
}

export function hexToRgba(hex, alpha = 0.14) {
  const raw = String(hex || '').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(185, 28, 28, ${alpha})`;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveClassColor(hex) {
  const value = String(hex || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value) || /^#[0-9a-fA-F]{3}$/.test(value)) return value;
  return COLORS.primary;
}

async function loadAll() {
  try {
    if (!FileSystem.documentDirectory) return {};
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return {};
    const data = JSON.parse(await FileSystem.readAsStringAsync(FILE));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export async function loadClassColors(email) {
  const all = await loadAll();
  const map = all[emailKey(email)];
  return map && typeof map === 'object' ? map : {};
}

export async function loadClassColor(email, classId) {
  const map = await loadClassColors(email);
  return resolveClassColor(map[classKey(classId)]);
}

export async function saveClassColor(email, classId, color) {
  if (!FileSystem.documentDirectory) return;
  const user = emailKey(email);
  const id = classKey(classId);
  if (!user || !id) return;
  const all = await loadAll();
  const current = all[user] && typeof all[user] === 'object' ? all[user] : {};
  all[user] = { ...current, [id]: resolveClassColor(color) };
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(all));
}
