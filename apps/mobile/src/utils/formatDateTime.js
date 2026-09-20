const CO_TZ = 'America/Bogota';
const CO_LOCALE = 'es-CO';

function toMillis(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function colombiaClock(ms) {
  return new Date(ms).toLocaleTimeString(CO_LOCALE, {
    timeZone: CO_TZ,
    hour: 'numeric',
    minute: '2-digit',
  });
}

function colombiaDate(ms) {
  return new Date(ms).toLocaleDateString(CO_LOCALE, {
    timeZone: CO_TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function colombiaDayKey(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

export function formatActionDateTime(value, fallback = '') {
  const ms = toMillis(value);
  if (ms == null) return fallback || String(value || '');
  const time = colombiaClock(ms);
  if (colombiaDayKey(ms) === colombiaDayKey(Date.now())) return `Hoy, ${time}`;
  return `${colombiaDate(ms)}, ${time}`;
}

export function formatClockTime(value, fallback = '') {
  const ms = toMillis(value);
  if (ms == null) {
    const s = String(value || '').trim();
    if (/^\d{1,2}:\d{2}/.test(s)) return s;
    return fallback;
  }
  return colombiaClock(ms);
}

export function colombiaTodayYmd() {
  return colombiaDayKey(Date.now());
}

export function extractYmd(value) {
  const s = String(value || '').trim();
  const m = s.match(/(20\d{2}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function ymdNoonMs(ymd) {
  const key = extractYmd(ymd);
  if (!key) return null;
  const ms = Date.parse(`${key}T12:00:00-05:00`);
  return Number.isNaN(ms) ? null : ms;
}

const EN_WEEKDAY_TO_KEY = {
  Sunday: 'SUNDAY',
  Monday: 'MONDAY',
  Tuesday: 'TUESDAY',
  Wednesday: 'WEDNESDAY',
  Thursday: 'THURSDAY',
  Friday: 'FRIDAY',
  Saturday: 'SATURDAY',
};

export function colombiaWeekdayKeyFromYmd(ymd) {
  const ms = ymdNoonMs(ymd);
  if (ms == null) return '';
  const en = new Date(ms).toLocaleDateString('en-US', { weekday: 'long', timeZone: CO_TZ });
  return EN_WEEKDAY_TO_KEY[en] || '';
}

export function colombiaWeekdayLongFromYmd(ymd) {
  const ms = ymdNoonMs(ymd);
  if (ms == null) return '';
  const w = new Date(ms).toLocaleDateString(CO_LOCALE, { weekday: 'long', timeZone: CO_TZ });
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
}

export function colombiaDateLongFromYmd(ymd) {
  const ms = ymdNoonMs(ymd);
  if (ms == null) return extractYmd(ymd) || String(ymd || '');
  return new Date(ms).toLocaleDateString(CO_LOCALE, {
    timeZone: CO_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function colombiaYmdFromEpoch(epoch) {
  const n = Number(epoch);
  if (!Number.isFinite(n) || n <= 0) return '';
  const ms = n < 1e12 ? n * 1000 : n;
  return colombiaDayKey(ms);
}

export function colombiaYmdFromMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  return colombiaDayKey(n);
}

export function ymdFromSessionId(sessionId) {
  const m = String(sessionId || '').trim().match(/_(20\d{2}-\d{2}-\d{2})$/);
  return m ? m[1] : '';
}

export function colombiaNowMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  let hh = Number(parts.find((p) => p.type === 'hour')?.value);
  const mm = Number(parts.find((p) => p.type === 'minute')?.value);
  if (hh === 24) hh = 0;
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}
