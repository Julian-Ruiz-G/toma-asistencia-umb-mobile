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
