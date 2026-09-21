import * as FileSystem from 'expo-file-system/legacy';

import { normalizeDay } from './schedule';
import { isDeviceNotificationsEnabled } from './appSettings';
import {
  cancelReminderNotification,
  ensureNotificationPermission,
  isExpoGo,
  scheduleReminderNotification,
} from './localNotify';

const FILE = `${FileSystem.documentDirectory || ''}umb-class-soon.json`;
const LEAD_MS = 5 * 60 * 1000;
const SHOW_AFTER_START_MS = 15 * 60 * 1000;

function emailKey(email) {
  return String(email || '').trim().toLowerCase();
}

function weekdayKey(date) {
  const n = date.getDay();
  return n === 0 ? 'SUNDAY'
    : n === 1 ? 'MONDAY'
    : n === 2 ? 'TUESDAY'
    : n === 3 ? 'WEDNESDAY'
    : n === 4 ? 'THURSDAY'
    : n === 5 ? 'FRIDAY'
    : 'SATURDAY';
}

function parseHm(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { hh: Number(m[1]), mm: Number(m[2]) };
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

async function saveAll(all) {
  if (!FileSystem.documentDirectory) return;
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(all || {}));
}

export async function loadClassSoon(email) {
  const all = await loadAll();
  const row = all[emailKey(email)];
  const alerts = Array.isArray(row?.alerts) ? row.alerts : [];
  return { alerts, notificationIds: Array.isArray(row?.notificationIds) ? row.notificationIds : [] };
}

export async function saveClassSoon(email, payload) {
  const key = emailKey(email);
  if (!key) return;
  const all = await loadAll();
  all[key] = {
    alerts: Array.isArray(payload?.alerts) ? payload.alerts : [],
    notificationIds: Array.isArray(payload?.notificationIds) ? payload.notificationIds : [],
  };
  await saveAll(all);
}

export function classSoonIsDue(alert) {
  const notifyAt = Number(alert?.notifyAt || 0);
  const startAt = Number(alert?.startAt || 0);
  const now = Date.now();
  if (!notifyAt || !startAt) return false;
  return now >= notifyAt && now <= startAt + SHOW_AFTER_START_MS;
}

export function upcomingClassSoonAlerts(classes, daysAhead = 14) {
  const now = Date.now();
  const out = [];
  const list = Array.isArray(classes) ? classes : [];
  for (const c of list) {
    const classId = String(c?.classId || c?.id || '').trim();
    const className = String(c?.className || c?.subject || c?.name || 'la clase');
    const schedule = Array.isArray(c?.schedule) ? c.schedule : [];
    for (let i = 0; i < daysAhead; i += 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + i);
      const want = weekdayKey(day);
      for (const block of schedule) {
        const dayKey = normalizeDay(block?.day) || String(block?.day || '').toUpperCase();
        if (dayKey !== want) continue;
        const hm = parseHm(block?.startTime || block?.start);
        if (!hm) continue;
        const start = new Date(day);
        start.setHours(hm.hh, hm.mm, 0, 0);
        const startAt = start.getTime();
        const notifyAt = startAt - LEAD_MS;
        if (notifyAt <= now + 15000) continue;
        const time = `${String(hm.hh).padStart(2, '0')}:${String(hm.mm).padStart(2, '0')}`;
        const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
        out.push({
          id: `classsoon:${classId}:${date}:${time}`,
          classId,
          className,
          date,
          time,
          startAt,
          notifyAt,
          read: false,
        });
      }
    }
  }
  return out;
}

export async function syncClassSoonNotifications(email, classes) {
  const prev = await loadClassSoon(email);
  await cancelReminderNotification(prev.notificationIds);
  const alerts = upcomingClassSoonAlerts(classes);
  const notificationIds = [];
  const deviceOn = isDeviceNotificationsEnabled();
  if (deviceOn && !isExpoGo) {
    await ensureNotificationPermission();
  }
  if (deviceOn) {
    for (const alert of alerts) {
      const nid = await scheduleReminderNotification({
        id: alert.id,
        type: 'classSoon',
        title: 'Clase por comenzar',
        description: `${alert.className} empieza a las ${alert.time}. Faltan 5 minutos.`,
        when: new Date(alert.notifyAt),
      });
      if (nid) notificationIds.push(nid);
    }
  }
  const prevById = new Map((prev.alerts || []).map((a) => [a.id, a]));
  const merged = alerts.map((a) => ({
    ...a,
    read: Boolean(prevById.get(a.id)?.read),
  }));
  await saveClassSoon(email, { alerts: merged, notificationIds });
  return merged;
}
