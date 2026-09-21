import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Search } from 'lucide-react-native';

import { FilterChips, HBarChart, StatusBreakdown, WeekBars } from '../../components/MiniCharts';
import { useColors } from '../../ui/ThemeContext';
import { useAuth } from '../../state/auth';
import { personDisplayName } from '../../utils/displayName';
import { formatActionDateTime } from '../../utils/formatDateTime';
import { fetchAdminDashboard, filterAttendanceRows, labelKey, lastNDayBuckets, prettyLabel, statusLabel, weekdayShort } from '../../utils/adminDashboard';

const SECTIONS = {
  students: {
    title: 'Estudiantes',
    subtitle: 'Solo estadísticas institucionales',
  },
  teachers: {
    title: 'Docentes',
    subtitle: 'Solo estadísticas institucionales',
  },
  attendance: {
    title: 'Asistencia',
    subtitle: 'Filtra por día, semana, corte o semestre',
  },
  reports: {
    title: 'Sesiones',
    subtitle: 'Tomas de asistencia y reconocimiento facial',
  },
};

export default function AdminInsight({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken } = useAuth();
  const section = String(route?.params?.section || 'students');
  const meta = SECTIONS[section] || SECTIONS.students;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState('');
  const [semester, setSemester] = useState('');
  const [load, setLoad] = useState('');
  const [period, setPeriod] = useState('');
  const [attRange, setAttRange] = useState(String(route?.params?.range || 'week'));
  const [attCorte, setAttCorte] = useState(String(route?.params?.corte || '1'));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchAdminDashboard(authToken);
      setData(next);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const students = data?.students?.list || [];
  const teachers = data?.teachers?.list || [];
  const attendance = data?.attendance?.recentList || [];

  const programOptions = useMemo(
    () => [{ id: '', label: 'Todas las carreras' }, ...uniqueOpts(students.map((s) => s.program), 'carrera')],
    [students]
  );
  const semesterOptions = useMemo(
    () => [{ id: '', label: 'Todos los semestres' }, ...uniqueOpts(students.map((s) => s.semester), 'sem.')],
    [students]
  );
  const periodOptions = useMemo(
    () => [{ id: '', label: 'Todos los cortes' }, ...uniqueOpts(teachers.flatMap((t) => t.periods), 'corte')],
    [teachers]
  );

  const rangedAttendance = useMemo(
    () => filterAttendanceRows(attendance, {
      range: attRange,
      corte: attCorte,
      today: data?.date,
    }),
    [attendance, attRange, attCorte, data]
  );

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (program && labelKey(s.program) !== program) return false;
      if (semester && labelKey(s.semester) !== semester) return false;
      if (!q) return true;
      return [s.fullName, s.email, s.studentCode, s.program, s.semester].join(' ').toLowerCase().includes(q);
    });
  }, [students, query, program, semester]);

  const filteredTeachers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teachers.filter((t) => {
      if (load === 'with' && t.subjectsCount <= 0) return false;
      if (load === 'without' && t.subjectsCount > 0) return false;
      if (period && !(t.periods || []).some((p) => labelKey(p) === period)) return false;
      if (!q) return true;
      return [t.fullName, t.email, t.teacherCode].join(' ').toLowerCase().includes(q);
    });
  }, [teachers, query, load, period]);

  const filteredAttendance = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rangedAttendance.filter((r) => {
      if (!q) return true;
      return [r.studentName, r.studentEmail, r.className, r.program, r.semester].join(' ').toLowerCase().includes(q);
    });
  }, [rangedAttendance, query]);

  const studentCharts = useMemo(() => ({
    byProgram: countLocal(filteredStudents, (s) => s.program),
    bySemester: countLocal(filteredStudents, (s) => s.semester),
  }), [filteredStudents]);

  const teacherCharts = useMemo(() => ({
    byLoad: [
      { label: 'Con clases', count: filteredTeachers.filter((t) => t.subjectsCount > 0).length },
      { label: 'Sin clases', count: filteredTeachers.filter((t) => t.subjectsCount <= 0).length },
    ],
    byTeacher: filteredTeachers
      .slice()
      .sort((a, b) => b.subjectsCount - a.subjectsCount)
      .slice(0, 8)
      .map((t) => ({ label: personDisplayName(t.fullName, String(t.email || '').split('@')[0] || 'Docente'), count: t.subjectsCount })),
    byPeriod: countLocal(filteredTeachers.flatMap((t) => t.periods || [])),
  }), [filteredTeachers]);

  const weekDays = useMemo(
    () => lastNDayBuckets(filteredAttendance, data?.date, attRange === 'day' ? 1 : 7),
    [filteredAttendance, data, attRange]
  );

  const attStats = useMemo(() => ({
    present: filteredAttendance.filter((r) => r.status === 'asistencia').length,
    late: filteredAttendance.filter((r) => r.status === 'retardo').length,
    absent: filteredAttendance.filter((r) => r.status === 'inasistencia').length,
    byProgram: countLocal(filteredAttendance, (r) => r.program),
    bySemester: countLocal(filteredAttendance, (r) => r.semester),
    byClass: countLocal(filteredAttendance, (r) => r.className),
  }), [filteredAttendance]);

  const photo = data?.sessions?.photo || {};
  const photoChart = [
    { label: 'Reconocidos', count: photo.recognized || 0 },
    { label: 'No reconocidos', count: photo.unrecognized || 0 },
    { label: 'Sesiones sin foto', count: photo.sessionsWithoutPhoto || 0 },
  ].filter((row) => row.count > 0);
  const photoTotal = (photo.recognized || 0) + (photo.unrecognized || 0);
  const photoPct = photoTotal > 0 ? Math.round(((photo.recognized || 0) / photoTotal) * 100) : 0;

  const manage = () => {
    if (section === 'students') navigation.navigate('AdminStudents');
    if (section === 'teachers') navigation.navigate('AdminTeachers');
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={20} color={COLORS.white} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{meta.title}</Text>
            <Text style={styles.headerSubtitle}>{meta.subtitle}</Text>
          </View>
        </View>
        {section === 'attendance' ? (
          <View style={styles.searchWrap}>
            <Search size={16} color="rgba(255,255,255,0.7)" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar estudiante o clase"
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.searchInput}
            />
          </View>
        ) : null}
      </View>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.muted}>Cargando tablero…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {section === 'students' ? (
            <>
              <View style={styles.kpiRow}>
                <Kpi colors={COLORS} label="Estudiantes" value={filteredStudents.length} />
                <Kpi colors={COLORS} label="Carreras" value={studentCharts.byProgram.filter((x) => x.label !== 'Sin dato').length} />
                <Kpi colors={COLORS} label="Semestres" value={studentCharts.bySemester.filter((x) => x.label !== 'Sin dato').length} />
              </View>
              <Card colors={COLORS} title="Por carrera">
                <FilterChips colors={COLORS} options={programOptions} value={program} onChange={setProgram} />
                <HBarChart items={studentCharts.byProgram} colors={COLORS} />
              </Card>
              <Card colors={COLORS} title="Por semestre">
                <FilterChips colors={COLORS} options={semesterOptions} value={semester} onChange={setSemester} />
                <HBarChart items={studentCharts.bySemester} colors={COLORS} />
              </Card>
              <Pressable onPress={manage} style={styles.manageBtn}>
                <Text style={styles.manageText}>Ir a gestión de estudiantes</Text>
              </Pressable>
            </>
          ) : null}

          {section === 'teachers' ? (
            <>
              <View style={styles.kpiRow}>
                <Kpi colors={COLORS} label="Docentes" value={filteredTeachers.length} />
                <Kpi colors={COLORS} label="Con clases" value={filteredTeachers.filter((t) => t.subjectsCount > 0).length} />
                <Kpi colors={COLORS} label="Materias" value={filteredTeachers.reduce((n, t) => n + t.subjectsCount, 0)} />
              </View>
              <Card colors={COLORS} title="Carga de clases">
                <FilterChips
                  colors={COLORS}
                  value={load}
                  onChange={setLoad}
                  options={[
                    { id: '', label: 'Todos' },
                    { id: 'with', label: 'Con clases' },
                    { id: 'without', label: 'Sin clases' },
                  ]}
                />
                <HBarChart items={teacherCharts.byLoad} colors={COLORS} />
              </Card>
              <Card colors={COLORS} title="Clases por docente">
                <HBarChart items={teacherCharts.byTeacher} colors={COLORS} emptyText="Ningún docente tiene clases aún." />
              </Card>
              {periodOptions.length > 1 ? (
                <Card colors={COLORS} title="Por corte">
                  <FilterChips colors={COLORS} options={periodOptions} value={period} onChange={setPeriod} />
                  <HBarChart items={teacherCharts.byPeriod} colors={COLORS} />
                </Card>
              ) : null}
              <Pressable onPress={manage} style={styles.manageBtn}>
                <Text style={styles.manageText}>Ir a gestión de docentes</Text>
              </Pressable>
            </>
          ) : null}

          {section === 'attendance' ? (
            <>
              <View style={styles.kpiRow}>
                <Kpi colors={COLORS} label="Registros" value={filteredAttendance.length} />
                <Kpi colors={COLORS} label="Hoy" value={filteredAttendance.filter((r) => r.date === data?.date).length} />
                <Kpi colors={COLORS} label="Clases" value={attStats.byClass.filter((x) => x.label !== 'Sin dato').length} />
              </View>
              <Card colors={COLORS} title="Asistencia">
                <FilterChips
                  colors={COLORS}
                  value={attRange}
                  onChange={(id) => setAttRange(id || 'week')}
                  options={[
                    { id: 'day', label: 'Día' },
                    { id: 'week', label: 'Semana' },
                    { id: 'corte', label: 'Corte' },
                    { id: 'semester', label: 'Semestre' },
                  ]}
                />
                {attRange === 'corte' ? (
                  <FilterChips
                    colors={COLORS}
                    value={attCorte}
                    onChange={(id) => setAttCorte(id || '1')}
                    options={[
                      { id: '1', label: 'Corte 1' },
                      { id: '2', label: 'Corte 2' },
                    ]}
                  />
                ) : null}
                <WeekBars days={weekDays} colors={COLORS} />
                <StatusBreakdown present={attStats.present} late={attStats.late} absent={attStats.absent} colors={COLORS} />
              </Card>
              <Card colors={COLORS} title="Por carrera">
                <HBarChart items={attStats.byProgram} colors={COLORS} emptyText="Cuando haya registros, aquí aparecerán las carreras." />
              </Card>
              <Card colors={COLORS} title="Por semestre">
                <HBarChart items={attStats.bySemester} colors={COLORS} emptyText="Cuando haya registros, aquí aparecerán los semestres." />
              </Card>
              <Card colors={COLORS} title="Por clase">
                <HBarChart items={attStats.byClass} colors={COLORS} emptyText="Cuando haya registros, aquí aparecerán las clases." />
              </Card>
              {filteredAttendance.slice(0, 80).map((r, idx) => (
                <View key={`${r.studentEmail}-${r.classId}-${r.markedAt}-${idx}`} style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemTitle}>{personDisplayName(r.studentName, r.studentEmail)}</Text>
                    <View style={[styles.badge, badgeStyle(r.status, COLORS)]}>
                      <Text style={[styles.badgeText, { color: badgeStyle(r.status, COLORS).color }]}>{statusLabel(r.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemMeta}>
                    {r.className || 'Clase'}{r.group ? ` · Grupo ${r.group}` : ''}
                  </Text>
                  <Text style={styles.profileLine}>Carrera: {prettyLabel(r.program, 'Pendiente en perfil')}</Text>
                  <Text style={styles.profileLine}>Semestre: {prettyLabel(r.semester, 'Pendiente en perfil')}</Text>
                  <Text style={styles.itemMeta}>{formatActionDateTime(r.markedAt, r.date || '')}</Text>
                </View>
              ))}
              {!filteredAttendance.length ? <Text style={styles.muted}>No hay registros con ese filtro.</Text> : null}
            </>
          ) : null}

          {section === 'reports' ? (
            <>
              <View style={styles.kpiRow}>
                <Kpi colors={COLORS} label="Sesiones hoy" value={data?.sessions?.today || 0} />
                <Kpi colors={COLORS} label="Con foto" value={photo.sessionsWithPhoto || 0} />
                <Kpi colors={COLORS} label="Efectividad" value={photoTotal ? `${photoPct}%` : '—'} />
              </View>
              <Card colors={COLORS} title="Efectividad del reconocimiento facial">
                <Text style={styles.itemMeta}>
                  Rostros detectados esta semana: {photo.facesDetected || 0}
                </Text>
                <HBarChart
                  items={photoChart}
                  colors={COLORS}
                  emptyText="Cuando se tomen fotos de asistencia, aquí verás reconocidos y no reconocidos."
                />
              </Card>
              <Card colors={COLORS} title="Sesiones de la semana">
                <WeekBars
                  days={(data?.attendance?.last7Days || []).map((d) => ({
                    date: d.date,
                    label: weekdayShort(d.date),
                    total: d.sessions,
                    asistencia: d.sessions,
                    retardo: 0,
                    inasistencia: 0,
                  }))}
                  colors={COLORS}
                />
              </Card>
              {(data?.sessions?.todayList || []).map((s) => (
                <View key={s.sessionId || `${s.classId}-${s.teacherEmail}`} style={styles.itemCard}>
                  <Text style={styles.itemTitle}>{s.className || 'Clase'}</Text>
                  <Text style={styles.itemMeta}>
                    {s.group ? `Grupo ${s.group} · ` : ''}{s.hasPhoto ? 'Foto tomada' : 'Sin foto'}
                  </Text>
                  {s.hasPhoto ? (
                    <Text style={styles.profileLine}>
                      {s.recognized || 0} reconocidos · {s.unrecognized || 0} no reconocidos
                      {s.facesDetected ? ` · ${s.facesDetected} rostros` : ''}
                    </Text>
                  ) : null}
                </View>
              ))}
              {!(data?.sessions?.todayList || []).length ? (
                <Text style={styles.muted}>Hoy no se ha abierto ninguna sesión de asistencia.</Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function uniqueOpts(values, suffix) {
  const seen = new Map();
  for (const raw of values || []) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const key = labelKey(text);
    if (!key || seen.has(key)) continue;
    const label = prettyLabel(text);
    seen.set(key, { id: key, label: suffix === 'sem.' ? `Sem. ${label}` : label });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

function countLocal(list, getter) {
  const acc = {};
  const arr = Array.isArray(list) ? list : [];
  for (const item of arr) {
    const raw = typeof getter === 'function' ? getter(item) : item;
    const key = labelKey(raw) || 'sin-dato';
    const label = prettyLabel(raw);
    if (!acc[key]) acc[key] = { label, count: 0 };
    acc[key].count += 1;
  }
  return Object.values(acc).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
}

function badgeStyle(status, COLORS) {
  if (status === 'asistencia') return { backgroundColor: COLORS.successBg, color: COLORS.success };
  if (status === 'retardo') return { backgroundColor: COLORS.warningBg, color: COLORS.warning };
  return { backgroundColor: COLORS.dangerBg, color: COLORS.dangerStrong };
}

function Kpi({ colors, label, value }) {
  return (
    <View style={[kpiStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[kpiStyles.label, { color: colors.muted }]}>{label}</Text>
      <Text style={[kpiStyles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function Card({ colors, title, children }) {
  return (
    <View style={[kpiStyles.block, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[kpiStyles.blockTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
  label: { fontSize: 11, fontWeight: '800' },
  value: { marginTop: 4, fontSize: 18, fontWeight: '900' },
  block: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  blockTitle: { fontWeight: '900', fontSize: 14 },
});

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700' },
  searchWrap: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, color: COLORS.white, paddingVertical: 4, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 32, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: COLORS.muted, fontWeight: '700', textAlign: 'center' },
  kpiRow: { flexDirection: 'row', gap: 10 },
  itemCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemTitle: { fontWeight: '900', color: COLORS.text, flex: 1 },
  itemMeta: { marginTop: 4, color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  profileLine: { marginTop: 4, color: COLORS.textSecondary, fontSize: 13, fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '900' },
  manageBtn: { marginTop: 4, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  manageText: { color: COLORS.white, fontWeight: '900' },
});
