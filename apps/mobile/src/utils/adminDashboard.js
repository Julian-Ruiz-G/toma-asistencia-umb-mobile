import { ADMIN_DASHBOARD_STATS_URL, ADMIN_STUDENTS_URL, ADMIN_TEACHERS_URL } from '../config';
import { colombiaWeekdayLongFromYmd } from './formatDateTime';

const CACHE_MS = 25000;
let cache = { token: '', at: 0, data: null };

export function labelKey(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

const SMALL_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'en', 'a', 'al', 'para', 'por']);

export function prettyLabel(raw, empty = 'Sin dato') {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return empty;
  const words = text.toLocaleLowerCase('es').split(' ');
  return words
    .map((word, idx) => {
      if (idx > 0 && SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase('es') + word.slice(1);
    })
    .join(' ');
}

export function sameLabel(a, b) {
  return labelKey(a) === labelKey(b);
}

export function countBy(list, getter) {
  const acc = {};
  for (const item of list || []) {
    const raw = typeof getter === 'function'
      ? getter(item)
      : getter
        ? item?.[getter]
        : item;
    const key = labelKey(raw) || 'sin-dato';
    const label = prettyLabel(raw);
    if (!acc[key]) acc[key] = { label, count: 0 };
    acc[key].count += 1;
  }
  return Object.values(acc).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
}

export function weekdayShort(ymd) {
  const long = colombiaWeekdayLongFromYmd(ymd);
  if (!long) return String(ymd || '').slice(8, 10) || '—';
  return long.slice(0, 3).replace('.', '');
}

export function shiftYmd(ymd, days) {
  const parts = String(ymd || '').split('-').map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return '';
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  return dt.toISOString().slice(0, 10);
}

export function filterAttendanceRows(rows, { range = 'week', corte = '1', today = '' } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const day = String(today || '').trim();
  if (range === 'day') return list.filter((r) => String(r.date || '') === day);
  if (range === 'week') {
    const start = shiftYmd(day, -6);
    return list.filter((r) => {
      const d = String(r.date || '');
      return d && (!start || d >= start) && (!day || d <= day);
    });
  }
  if (range === 'corte') {
    const want = String(corte || '1');
    return list.filter((r) => String(r.corte || '1') === want);
  }
  return list;
}

export function lastNDayBuckets(rows, today, days = 7) {
  const byDate = {};
  for (const r of rows || []) {
    const date = String(r?.date || '');
    if (!date) continue;
    if (!byDate[date]) {
      byDate[date] = { date, asistencia: 0, retardo: 0, inasistencia: 0, total: 0 };
    }
    const status = String(r.status || '');
    if (status === 'asistencia' || status === 'retardo' || status === 'inasistencia') {
      byDate[date][status] += 1;
      byDate[date].total += 1;
    }
  }
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = shiftYmd(today, -i);
    const bucket = byDate[date] || { date, asistencia: 0, retardo: 0, inasistencia: 0, total: 0 };
    out.push({ ...bucket, label: weekdayShort(date) });
  }
  return out;
}

export function statusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'asistencia' || s === 'presente') return 'Asistencia';
  if (s === 'retardo') return 'Retardo';
  if (s === 'inasistencia') return 'Inasistencia';
  return 'Registro';
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

export function emptyDashboard() {
  return {
    date: '',
    students: { total: 0, withFace: 0, withoutFace: 0, byProgram: [], bySemester: [], list: [] },
    teachers: { total: 0, withClasses: 0, withoutClasses: 0, classesTotal: 0, byPeriod: [], list: [] },
    attendance: {
      markedToday: 0,
      presentToday: 0,
      lateToday: 0,
      absentToday: 0,
      byStatusToday: [],
      last7Days: [],
      byProgramToday: [],
      byClassToday: [],
      todayList: [],
      recentList: [],
    },
    sessions: { today: 0, last7Days: [], todayList: [] },
    reportsTotal: 0,
    classesTotal: 0,
  };
}

function pickText(row, keys) {
  for (const key of keys) {
    const value = String(row?.[key] || '').trim();
    if (value && value !== '—') return value;
  }
  return '';
}

function mapStudent(row) {
  return {
    email: String(row?.email || ''),
    fullName: String(row?.fullName || ''),
    studentCode: String(row?.studentCode || ''),
    program: pickText(row, ['program', 'carrera', 'Program', 'Carrera']),
    semester: pickText(row, ['semester', 'semestre', 'Semester', 'Semestre']),
    phone: pickText(row, ['phone', 'telefono', 'Phone']),
    hasFace: row?.hasFace === true,
    biometricConsent: row?.biometricConsent === true,
    acceptTerms: row?.acceptTerms === true,
    acceptPrivacy: row?.acceptPrivacy === true,
  };
}

function mapTeacher(row) {
  const classes = asList(row?.classes);
  const periods = asList(row?.periods).length
    ? asList(row.periods).map(String)
    : [...new Set(classes.map((c) => String(c?.period || '').trim()).filter(Boolean))];
  return {
    email: String(row?.email || ''),
    fullName: String(row?.fullName || ''),
    teacherCode: String(row?.teacherCode || ''),
    subjectsCount: num(row?.subjectsCount, classes.length),
    periods,
    classes,
    acceptTerms: row?.acceptTerms === true ? true : row?.acceptTerms === false ? false : null,
    acceptPrivacy: row?.acceptPrivacy === true ? true : row?.acceptPrivacy === false ? false : null,
  };
}

function mergeStudents(primary, fallback) {
  const byEmail = {};
  for (const row of fallback || []) {
    if (row.email) byEmail[row.email] = row;
  }
  if (!(primary || []).length) return fallback || [];
  return primary.map((row) => {
    const extra = byEmail[row.email] || {};
    return {
      ...row,
      program: row.program || extra.program || '',
      semester: row.semester || extra.semester || '',
      phone: row.phone || extra.phone || '',
      fullName: row.fullName || extra.fullName || '',
      studentCode: row.studentCode || extra.studentCode || '',
      acceptTerms: row.acceptTerms || extra.acceptTerms || false,
      acceptPrivacy: row.acceptPrivacy || extra.acceptPrivacy || false,
      biometricConsent: row.biometricConsent || extra.biometricConsent || false,
      hasFace: row.hasFace || extra.hasFace || false,
    };
  });
}

function attachStudentProfile(rows, students) {
  const byEmail = {};
  for (const s of students || []) {
    if (s.email) byEmail[s.email] = s;
  }
  return (rows || []).map((row) => {
    const extra = byEmail[String(row?.studentEmail || '').trim().toLowerCase()] || {};
    return {
      ...row,
      program: pickText(row, ['program', 'carrera']) || extra.program || '',
      semester: pickText(row, ['semester', 'semestre']) || extra.semester || '',
      studentName: row?.studentName || extra.fullName || '',
      corte: String(row?.corte || extra.corte || '1'),
      sessionId: String(row?.sessionId || ''),
    };
  });
}

function normalize(json, extras = {}) {
  const list = mergeStudents(
    asList(json?.students?.list).map(mapStudent),
    asList(extras.students).map(mapStudent),
  );

  const teachersList = asList(json?.teachers?.list).map(mapTeacher);
  const extraTeachers = asList(extras.teachers).map(mapTeacher);
  const extraTeacherByEmail = {};
  for (const row of extraTeachers) {
    if (row.email) extraTeacherByEmail[row.email] = row;
  }
  const teachers = (teachersList.length ? teachersList : extraTeachers).map((row) => {
    const extra = extraTeacherByEmail[row.email] || {};
    return {
      ...row,
      fullName: row.fullName || extra.fullName || '',
      teacherCode: row.teacherCode || extra.teacherCode || '',
      acceptTerms: row.acceptTerms ?? extra.acceptTerms ?? null,
      acceptPrivacy: row.acceptPrivacy ?? extra.acceptPrivacy ?? null,
    };
  });

  const last7 = asList(json?.attendance?.last7Days).map((d) => ({
    date: String(d?.date || ''),
    asistencia: num(d?.asistencia),
    retardo: num(d?.retardo),
    inasistencia: num(d?.inasistencia),
    total: num(d?.total, num(d?.asistencia) + num(d?.retardo) + num(d?.inasistencia)),
    sessions: num(d?.sessions),
  }));

  const todayList = attachStudentProfile(asList(json?.attendance?.todayList), list);
  const recentList = attachStudentProfile(
    asList(json?.attendance?.recentList).length ? asList(json.attendance.recentList) : todayList,
    list,
  );
  const presentToday = num(json?.attendance?.presentToday);
  const lateToday = num(json?.attendance?.lateToday);
  const absentToday = num(json?.attendance?.absentToday);

  return {
    date: String(json?.date || ''),
    students: {
      total: num(json?.students?.total, list.length),
      withFace: num(json?.students?.withFace, list.filter((s) => s.hasFace).length),
      withoutFace: num(json?.students?.withoutFace, list.filter((s) => !s.hasFace).length),
      byProgram: countBy(list, 'program'),
      bySemester: countBy(list, 'semester'),
      list,
    },
    teachers: {
      total: num(json?.teachers?.total, teachers.length),
      withClasses: num(json?.teachers?.withClasses, teachers.filter((t) => t.subjectsCount > 0).length),
      withoutClasses: num(json?.teachers?.withoutClasses, teachers.filter((t) => t.subjectsCount <= 0).length),
      classesTotal: num(json?.teachers?.classesTotal ?? json?.classes?.total),
      byPeriod: asList(json?.teachers?.byPeriod).length
        ? asList(json.teachers.byPeriod)
        : countBy(teachers.flatMap((t) => t.periods)),
      list: teachers,
    },
    attendance: {
      markedToday: num(json?.attendance?.markedToday, todayList.length),
      presentToday,
      lateToday,
      absentToday,
      byStatusToday: asList(json?.attendance?.byStatusToday).length
        ? asList(json.attendance.byStatusToday)
        : [
            { label: 'Asistencia', status: 'asistencia', count: presentToday },
            { label: 'Retardo', status: 'retardo', count: lateToday },
            { label: 'Inasistencia', status: 'inasistencia', count: absentToday },
          ],
      last7Days: last7,
      byProgramToday: countBy(todayList, 'program'),
      byClassToday: asList(json?.attendance?.byClassToday),
      todayList,
      recentList,
    },
    sessions: {
      today: num(json?.sessions?.today ?? json?.reports?.total),
      last7Days: asList(json?.sessions?.last7Days),
      todayList: asList(json?.sessions?.todayList),
      photo: {
        sessionsWithPhoto: num(json?.sessions?.photo?.sessionsWithPhoto),
        sessionsWithoutPhoto: num(json?.sessions?.photo?.sessionsWithoutPhoto),
        facesDetected: num(json?.sessions?.photo?.facesDetected),
        recognized: num(json?.sessions?.photo?.recognized),
        unrecognized: num(json?.sessions?.photo?.unrecognized),
      },
    },
    reportsTotal: num(json?.reports?.total ?? json?.sessions?.today),
    classesTotal: num(json?.classes?.total ?? json?.teachers?.classesTotal),
  };
}

async function postJson(url, authToken) {
  if (!url || !authToken) return null;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({}),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!resp.ok) return null;
  return json;
}

export async function fetchAdminDashboard(authToken, { force = false } = {}) {
  if (!authToken) return emptyDashboard();
  if (!force && cache.data && cache.token === authToken && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  const [stats, studentsJson, teachersJson] = await Promise.all([
    postJson(ADMIN_DASHBOARD_STATS_URL, authToken),
    postJson(ADMIN_STUDENTS_URL, authToken),
    postJson(ADMIN_TEACHERS_URL, authToken),
  ]);
  const data = normalize(stats || {}, {
    students: asList(studentsJson?.students),
    teachers: asList(teachersJson?.teachers),
  });
  cache = { token: authToken, at: Date.now(), data };
  return data;
}
