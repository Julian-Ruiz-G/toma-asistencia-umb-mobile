import { COLORS } from '../ui/theme';
import {
  colombiaNowMinutes,
  colombiaTodayYmd,
  colombiaWeekdayKeyFromYmd,
  colombiaYmdFromEpoch,
  colombiaYmdFromMs,
  extractYmd,
  ymdFromSessionId,
} from './formatDateTime';

export const normalizeDay = (raw) => {
  const s = String(raw || '').trim().toLowerCase();
  const map = {
    'lunes': 'MONDAY', 'lun': 'MONDAY', 'monday': 'MONDAY', 'mon': 'MONDAY',
    'martes': 'TUESDAY', 'mar': 'TUESDAY', 'tuesday': 'TUESDAY', 'tue': 'TUESDAY',
    'miercoles': 'WEDNESDAY', 'miércoles': 'WEDNESDAY', 'mie': 'WEDNESDAY', 'mié': 'WEDNESDAY', 'wednesday': 'WEDNESDAY', 'wed': 'WEDNESDAY',
    'jueves': 'THURSDAY', 'jue': 'THURSDAY', 'thursday': 'THURSDAY', 'thu': 'THURSDAY',
    'viernes': 'FRIDAY', 'vie': 'FRIDAY', 'friday': 'FRIDAY', 'fri': 'FRIDAY',
    'sabado': 'SATURDAY', 'sábado': 'SATURDAY', 'sab': 'SATURDAY', 'saturday': 'SATURDAY', 'sat': 'SATURDAY',
    'domingo': 'SUNDAY', 'dom': 'SUNDAY', 'sunday': 'SUNDAY', 'sun': 'SUNDAY',
  };
  return map[s] || '';
};

export const parseScheduleText = (text) => {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const m = line.match(/^(.+?)\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*$/);
    if (!m) continue;
    const day = normalizeDay(m[1]);
    if (!day) continue;
    out.push({ day, startTime: m[2], endTime: m[3] });
  }
  return out;
};

export const formatScheduleText = (schedule) => {
  if (!Array.isArray(schedule) || !schedule.length) return '';
  return schedule
    .map(s => `${String(s?.day || '')} ${String(s?.startTime || '')}-${String(s?.endTime || '')}`.trim())
    .filter(Boolean)
    .join('\n');
};

export const DAY_SHORT = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

export const DAY_LONG = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export function todayScheduleKey() {
  return colombiaWeekdayKeyFromYmd(colombiaTodayYmd()) || 'SUNDAY';
}

export function getClassSchedule(c) {
  const raw = c?.schedule || c?.schedules || c?.horario || c?.horarios;
  return Array.isArray(raw) ? raw : [];
}

function parseTimeToMinutes(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

export function isClassScheduledToday(c) {
  const today = todayScheduleKey();
  return getClassSchedule(c).some((s) => normalizeDay(s?.day || s?.dia) === today);
}

export function scheduleHoursForYmd(schedule, ymd) {
  const key = colombiaWeekdayKeyFromYmd(ymd);
  const items = Array.isArray(schedule) ? schedule : [];
  const blocks = items
    .filter((s) => normalizeDay(s?.day || s?.dia) === key)
    .sort((a, b) => String(a?.startTime || a?.start || '').localeCompare(String(b?.startTime || b?.start || '')));
  if (!blocks.length) {
    return { startTime: '', endTime: '', dayKey: key };
  }
  return {
    startTime: String(blocks[0]?.startTime || blocks[0]?.start || ''),
    endTime: String(blocks[blocks.length - 1]?.endTime || blocks[blocks.length - 1]?.end || ''),
    dayKey: key,
  };
}

export function isClassInProgressNow(c) {
  const today = todayScheduleKey();
  const nowMin = colombiaNowMinutes();
  return getClassSchedule(c).some((s) => {
    if (normalizeDay(s?.day || s?.dia) !== today) return false;
    const startMin = parseTimeToMinutes(s?.startTime || s?.start || s?.horaInicio);
    const endMin = parseTimeToMinutes(s?.endTime || s?.end || s?.horaFin);
    if (startMin == null || endMin == null) return false;
    return nowMin >= startMin && nowMin <= endMin;
  });
}

const WEEK_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/** Minutos que faltan para el próximo bloque de la clase (0 si está en curso; Infinity sin horario). */
export function minutesUntilNextClass(c) {
  if (isClassInProgressNow(c)) return 0;
  const todayIdx = WEEK_ORDER.indexOf(todayScheduleKey());
  const nowMin = colombiaNowMinutes();
  let best = Infinity;
  for (const s of getClassSchedule(c)) {
    const dayIdx = WEEK_ORDER.indexOf(normalizeDay(s?.day || s?.dia));
    const startMin = parseTimeToMinutes(s?.startTime || s?.start || s?.horaInicio);
    if (dayIdx < 0 || startMin == null) continue;
    let days = (dayIdx - todayIdx + 7) % 7;
    if (days === 0 && startMin < nowMin) days = 7; // la de hoy ya pasó: cuenta la de la próxima semana
    best = Math.min(best, days * 1440 + startMin - nowMin);
  }
  return best;
}

export const CLASS_SORT_OPTIONS = [
  { id: 'schedule', label: 'Por horario' },
  { id: 'alpha', label: 'A–Z' },
];

function classTitle(c) {
  return String(c?.className || c?.subject || c?.name || '');
}

/**
 * Orden de las listas de clases del docente. La clase en curso siempre va primero;
 * después, 'schedule' = la próxima en la semana primero, 'alpha' = por nombre y grupo.
 */
export function sortClasses(list, mode = 'schedule') {
  const byName = (a, b) => classTitle(a).localeCompare(classTitle(b), 'es', { sensitivity: 'base' })
    || String(a?.group || '').localeCompare(String(b?.group || ''), 'es');
  return [...(Array.isArray(list) ? list : [])]
    .map((c) => ({ c, live: isClassInProgressNow(c), next: minutesUntilNextClass(c) }))
    .sort((a, b) => {
      if (a.live !== b.live) return a.live ? -1 : 1;
      if (mode === 'schedule' && a.next !== b.next) return a.next - b.next;
      return byName(a.c, b.c);
    })
    .map((x) => x.c);
}

// `palette`: la del tema activo (useColors); sin ella se usa la clara.
export function classStatusMeta(c, palette = COLORS) {
  if (isClassInProgressNow(c)) {
    return { key: 'in_session', label: 'En curso', pillBg: palette.successSoft, pillBorder: palette.successBorder, pillText: palette.successStrong };
  }
  return { key: 'off', label: 'Fuera de horario', pillBg: palette.surface, pillBorder: palette.border, pillText: palette.icon };
}

export function formatScheduleFriendly(c) {
  const items = getClassSchedule(c).map((s) => {
    const dayKey = normalizeDay(s?.day || s?.dia);
    const label = DAY_SHORT[dayKey] || String(s?.day || '');
    const start = s?.startTime || s?.start || s?.horaInicio || '';
    const end = s?.endTime || s?.end || s?.horaFin || '';
    const t = start && end ? `${start}–${end}` : start || end || '';
    return `${label} ${t}`.trim();
  }).filter(Boolean);
  return items.join(' · ');
}

export function formatScheduleLines(schedule) {
  if (!Array.isArray(schedule) || !schedule.length) return [];
  return schedule.map((s) => {
    const day = DAY_LONG[normalizeDay(s?.day)] || String(s?.day || '');
    const start = String(s?.startTime || '');
    const end = String(s?.endTime || '');
    const hours = start && end ? `${start} – ${end}` : start || end;
    return [day, hours].filter(Boolean).join(' · ');
  }).filter(Boolean);
}

export function resolveSessionYmd({ sessionDate, sessionId, scheduledStartEpoch, schedule } = {}) {
  const scheduledKeys = new Set(
    (Array.isArray(schedule) ? schedule : [])
      .map((s) => normalizeDay(s?.day || s?.dia))
      .filter(Boolean)
  );
  const candidates = [
    ymdFromSessionId(sessionId),
    extractYmd(sessionDate),
    colombiaYmdFromEpoch(scheduledStartEpoch),
  ].filter(Boolean);
  const unique = [...new Set(candidates)];

  for (const ymd of unique) {
    const key = colombiaWeekdayKeyFromYmd(ymd);
    if (!scheduledKeys.size || scheduledKeys.has(key)) return ymd;
  }

  const origin = unique[0];
  if (!origin || !scheduledKeys.size) return origin || '';

  const originMs = Date.parse(`${origin}T12:00:00-05:00`);
  if (Number.isNaN(originMs)) return origin;

  let best = '';
  let bestDist = 99;
  for (let i = -6; i <= 6; i += 1) {
    const cand = colombiaYmdFromMs(originMs + i * 86400000);
    const key = colombiaWeekdayKeyFromYmd(cand);
    if (scheduledKeys.has(key) && Math.abs(i) < bestDist) {
      best = cand;
      bestDist = Math.abs(i);
    }
  }
  return best || origin;
}

export const deriveStartEndFromSchedule = (schedule) => {
  try {
    if (!Array.isArray(schedule) || !schedule.length) return { startTime: '', endTime: '' };
    const sorted = [...schedule].sort((a, b) => {
      const as = String(a?.startTime || '99:99');
      const bs = String(b?.startTime || '99:99');
      return as.localeCompare(bs);
    });
    return {
      startTime: String(sorted[0]?.startTime || ''),
      endTime: String(sorted[0]?.endTime || ''),
    };
  } catch {
    return { startTime: '', endTime: '' };
  }
};
