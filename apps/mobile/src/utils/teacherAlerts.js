import * as FileSystem from 'expo-file-system/legacy';

import { getClassSchedule, normalizeDay } from './schedule';
import { isDeviceNotificationsEnabled } from './appSettings';
import {
  cancelReminderNotification,
  ensureNotificationPermission,
  isExpoGo,
  scheduleReminderNotification,
} from './localNotify';

const FILE = `${FileSystem.documentDirectory || ''}umb-teacher-alerts.json`;
const SOON_LEAD_MS = 5 * 60 * 1000;
const PHOTO_AFTER_MS = 8 * 60 * 1000;
const END_LEAD_MS = 10 * 60 * 1000;
const SOON_SHOW_AFTER_START_MS = 15 * 60 * 1000;
const END_SHOW_AFTER_MS = 5 * 60 * 1000;

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

function atDay(day, hm) {
  const d = new Date(day);
  d.setHours(hm.hh, hm.mm, 0, 0);
  return d.getTime();
}

function hhmm(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

export async function loadTeacherAlerts(email) {
  const all = await loadAll();
  const row = all[emailKey(email)];
  const alerts = Array.isArray(row?.alerts) ? row.alerts : [];
  return { alerts, notificationIds: Array.isArray(row?.notificationIds) ? row.notificationIds : [] };
}

export async function saveTeacherAlerts(email, payload) {
  const key = emailKey(email);
  if (!key) return;
  const all = await loadAll();
  all[key] = {
    alerts: Array.isArray(payload?.alerts) ? payload.alerts : [],
    notificationIds: Array.isArray(payload?.notificationIds) ? payload.notificationIds : [],
  };
  await saveAll(all);
}

export function teacherAlertCopy(alert) {
  const name = alert?.className || 'la clase';
  const start = alert?.time || hhmm(alert?.startAt);
  const end = alert?.endTime || hhmm(alert?.endAt);
  if (alert?.kind === 'teacherPhoto') {
    return {
      title: 'Toma la foto de asistencia',
      message: `Estás en ${name}. Captura la foto del salón para registrar a los estudiantes.`,
    };
  }
  if (alert?.kind === 'teacherEnd') {
    return {
      title: 'La clase termina pronto',
      message: `${name} termina a las ${end}. Revisa la lista de asistencia.`,
    };
  }
  return {
    title: 'Clase por comenzar',
    message: `${name} empieza a las ${start}. Faltan 5 minutos.`,
  };
}

export function teacherAlertIsDue(alert) {
  const notifyAt = Number(alert?.notifyAt || 0);
  const startAt = Number(alert?.startAt || 0);
  const endAt = Number(alert?.endAt || startAt + 60 * 60 * 1000);
  const now = Date.now();
  if (!notifyAt || !startAt) return false;
  if (alert?.kind === 'teacherPhoto') return now >= notifyAt && now <= endAt;
  if (alert?.kind === 'teacherEnd') return now >= notifyAt && now <= endAt + END_SHOW_AFTER_MS;
  return now >= notifyAt && now <= startAt + SOON_SHOW_AFTER_START_MS;
}

export function upcomingTeacherAlerts(classes, daysAhead = 14) {
  const now = Date.now();
  const out = [];
  const list = Array.isArray(classes) ? classes : [];

  const pushAlert = (alert, scheduleIfFuture) => {
    const due = teacherAlertIsDue(alert);
    const future = Number(alert.notifyAt) > now + 15000;
    if (!future && !due) return;
    out.push({ ...alert, schedule: Boolean(scheduleIfFuture && future) });
  };

  for (const c of list) {
    const classId = String(c?.classId || c?.id || '').trim();
    if (!classId) continue;
    const className = String(c?.className || c?.subject || c?.name || 'la clase');
    const group = String(c?.group || c?.groupName || c?.grupo || '');
    const room = String(c?.room || c?.classroom || c?.aula || '');
    const schedule = getClassSchedule(c);

    for (let i = 0; i < daysAhead; i += 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + i);
      const want = weekdayKey(day);
      const date = ymd(day);

      for (const block of schedule) {
        const dayKey = normalizeDay(block?.day || block?.dia) || String(block?.day || '').toUpperCase();
        if (dayKey !== want) continue;
        const startHm = parseHm(block?.startTime || block?.start);
        if (!startHm) continue;
        const endHm = parseHm(block?.endTime || block?.end);
        const startAt = atDay(day, startHm);
        const endAt = endHm ? atDay(day, endHm) : startAt + 2 * 60 * 60 * 1000;
        if (endAt <= startAt) continue;
        const time = `${String(startHm.hh).padStart(2, '0')}:${String(startHm.mm).padStart(2, '0')}`;
        const endTime = hhmm(endAt);
        const base = { classId, className, group, room, date, time, endTime, startAt, endAt, read: false };

        const soonNotify = startAt - SOON_LEAD_MS;
        pushAlert({
          ...base,
          id: `teachersoon:${classId}:${date}:${time}`,
          kind: 'teacherSoon',
          open: 'class',
          notifyAt: soonNotify,
        }, true);

        const photoAt = startAt + PHOTO_AFTER_MS;
        if (photoAt < endAt - 60 * 1000) {
          pushAlert({
            ...base,
            id: `teacherphoto:${classId}:${date}:${time}`,
            kind: 'teacherPhoto',
            open: 'photo',
            notifyAt: photoAt,
          }, true);
        }

        const endNotify = endAt - END_LEAD_MS;
        if (endNotify > startAt + 60 * 1000) {
          pushAlert({
            ...base,
            id: `teacherend:${classId}:${date}:${time}`,
            kind: 'teacherEnd',
            open: 'attendance',
            notifyAt: endNotify,
          }, true);
        }
      }
    }
  }
  return out;
}

export async function syncTeacherAlerts(email, classes) {
  const prev = await loadTeacherAlerts(email);
  await cancelReminderNotification(prev.notificationIds);
  const alerts = upcomingTeacherAlerts(classes);
  const notificationIds = [];
  const deviceOn = isDeviceNotificationsEnabled();
  if (deviceOn && !isExpoGo) {
    await ensureNotificationPermission();
  }
  if (deviceOn) {
    for (const alert of alerts) {
      if (!alert.schedule) continue;
      const copy = teacherAlertCopy(alert);
      const nid = await scheduleReminderNotification({
        id: alert.id,
        type: alert.kind,
        title: copy.title,
        description: copy.message,
        when: new Date(alert.notifyAt),
      });
      if (nid) notificationIds.push(nid);
    }
  }
  const prevById = new Map((prev.alerts || []).map((a) => [a.id, a]));
  const merged = alerts.map((a) => {
    const { schedule, ...rest } = a;
    return { ...rest, read: Boolean(prevById.get(a.id)?.read) };
  });
  await saveTeacherAlerts(email, { alerts: merged, notificationIds });
  return merged;
}
