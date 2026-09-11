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
