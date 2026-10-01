import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BookOpen, Calendar, MapPin, Search, Users, X } from 'lucide-react-native';

import { AdminNavButtons, useAdminDrawer } from '../../components/AdminDrawer';
import { MenuButton } from '../../components/RoleDrawer';
import FilterActiveBanner from '../../components/FilterActiveBanner';
import SelectMenu from '../../components/SelectMenu';
import { ADMIN_CLASSES_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { useColors } from '../../ui/ThemeContext';
import { personDisplayName } from '../../utils/displayName';
import { colombiaDateLongFromYmd } from '../../utils/formatDateTime';
import { prettyLabel } from '../../utils/adminDashboard';
import { FACULTIES, classProgramLabels, classTouchesProgram } from '../../utils/programs';
import { sameSemester, semesterTitle } from '../../components/AdminInsightDrill';
import { formatScheduleFriendly, formatScheduleLines } from '../../utils/schedule';
import { headerTop } from '../../ui/safeArea';

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'withStudents', label: 'Con estudiantes' },
  { key: 'empty', label: 'Sin estudiantes' },
  { key: 'lowAttendance', label: 'Asistencia < 70 %' },
];

function matches(cls, q) {
  if (!q) return true;
  return [cls.className, cls.group, cls.subjectCode, cls.teacherName, cls.teacherEmail, cls.room, classProgramLabels(cls).join(' ')]
    .some((v) => String(v || '').toLowerCase().includes(q));
}

export default function ClasesPage({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useAdminDrawer(navigation, 'AdminClasses');
  const { authToken } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(String(route?.params?.query || ''));
  const [filter, setFilter] = useState('all');
  const [program, setProgram] = useState(String(route?.params?.program || ''));
  const [teacherEmail, setTeacherEmail] = useState(String(route?.params?.teacherEmail || ''));
  const [semester, setSemester] = useState(String(route?.params?.semester || ''));
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!authToken || !ADMIN_CLASSES_URL) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(ADMIN_CLASSES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({}),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        const code = json?.error || '';
        throw new Error(code === 'UnknownRoute'
          ? 'El servidor aún no tiene esta función. Hay que desplegar la Lambda.'
          : json?.message || code || `HTTP ${resp.status}`);
      }
      setClasses(Array.isArray(json?.classes) ? json.classes : []);
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar las clases.');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useFocusEffect(useCallback(() => {
    if (route?.params?.program != null) setProgram(String(route.params.program || ''));
    if (route?.params?.teacherEmail != null) setTeacherEmail(String(route.params.teacherEmail || ''));
    if (route?.params?.semester != null) setSemester(String(route.params.semester || ''));
    if (route?.params?.query != null) setQuery(String(route.params.query || ''));
    load();
  }, [load, route?.params?.program, route?.params?.teacherEmail, route?.params?.semester, route?.params?.query]));

  const programOptions = useMemo(() => {
    const countOf = (name) => classes.filter((c) => classTouchesProgram(c, name)).length;
    const known = new Set();
    const options = [{ id: '', label: 'Todas las carreras', meta: String(classes.length) }];
    for (const faculty of FACULTIES) {
      for (const p of faculty.programs) {
        known.add(p.name);
        options.push({ id: p.name, label: p.name, meta: String(countOf(p.name)), group: faculty.name });
      }
    }
    for (const c of classes) {
      for (const name of classProgramLabels(c)) {
        if (!known.has(name)) {
          known.add(name);
          options.push({ id: name, label: prettyLabel(name), meta: String(countOf(name)), group: 'Otros' });
        }
      }
    }
    return options;
  }, [classes]);

  const hasProgramData = useMemo(
    () => classes.some((c) => classProgramLabels(c).length > 0),
    [classes]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classes.filter((c) => {
      if (!matches(c, q)) return false;
      if (program && hasProgramData && !classTouchesProgram(c, program)) return false;
      if (teacherEmail && String(c.teacherEmail || '').toLowerCase() !== String(teacherEmail).toLowerCase()) return false;
      if (semester && !(c.students || []).some((s) => sameSemester(s.semester, semester))) return false;
      if (filter === 'withStudents') return c.studentsCount > 0;
      if (filter === 'empty') return !c.studentsCount;
      if (filter === 'lowAttendance') return c.attendance?.rate != null && c.attendance.rate < 70;
      return true;
    });
  }, [classes, query, filter, program, hasProgramData, teacherEmail, semester]);

  const totals = useMemo(() => ({
    classes: classes.length,
    students: classes.reduce((n, c) => n + Number(c.studentsCount || 0), 0),
    sessions: classes.reduce((n, c) => n + Number(c.sessionsCount || 0), 0),
  }), [classes]);

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <AdminNavButtons onBack={goBack} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Clases</Text>
          <Text style={styles.headerSubtitle}>
            {loading ? 'Cargando…' : `${totals.classes} clases · ${totals.students} inscripciones · ${totals.sessions} sesiones`}
          </Text>
        </View>
        <MenuButton onPress={openDrawer} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl tintColor={COLORS.primary} colors={[COLORS.primary]} progressBackgroundColor={COLORS.card} refreshing={loading && classes.length > 0} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchWrap}>
          <Search size={16} color={COLORS.placeholder} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar clase, docente, código o salón"
            placeholderTextColor={COLORS.placeholder}
            style={styles.searchInput}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.pill, active ? styles.pillActive : null]}>
                <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <SelectMenu
          options={programOptions}
          value={program}
          onChange={(id) => setProgram(id || '')}
          placeholder="Filtrar por carrera"
        />
        {program || teacherEmail || semester ? (
          <FilterActiveBanner
            label={[
              program ? prettyLabel(program) : null,
              semester ? semesterTitle(semester) : null,
              teacherEmail ? 'Este docente' : null,
              `${filtered.length} ${filtered.length === 1 ? 'clase' : 'clases'}`,
            ].filter(Boolean).join(' · ')}
            onClear={() => {
              setProgram('');
              setTeacherEmail('');
              setSemester('');
            }}
          />
        ) : (
          <Text style={styles.filterHint}>Elige una carrera para ver solo sus clases. Una misma clase puede tener estudiantes de varias carreras.</Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && classes.length === 0 ? <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} /> : null}
        {!loading && !error && filtered.length === 0 ? (
          <Text style={styles.empty}>{classes.length ? (program ? `Ninguna clase tiene estudiantes de ${prettyLabel(program)}.` : 'Ninguna clase coincide con la búsqueda.') : 'Aún no hay clases creadas.'}</Text>
        ) : null}

        {filtered.map((c) => {
          const schedule = formatScheduleFriendly(c);
          const programs = classProgramLabels(c);
          const mixed = programs.length > 1;
          return (
            <Pressable key={c.classId} onPress={() => setSelected(c)} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <BookOpen size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.className} numberOfLines={1}>
                    {c.className || 'Clase sin nombre'}{c.group ? ` · ${c.group}` : ''}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {personDisplayName(c.teacherName, c.teacherEmail || 'Sin docente')}
                  </Text>
                </View>
                {c.subjectCode ? <Text style={styles.code}>{c.subjectCode}</Text> : null}
              </View>
              {programs.length ? (
                <Text style={styles.programLine} numberOfLines={2}>
                  {mixed ? `Varias carreras · ${programs.join(', ')}` : programs[0]}
                </Text>
              ) : null}
              {schedule || c.room ? (
                <Text style={styles.schedule} numberOfLines={2}>
                  {[schedule, c.room ? `Salón ${c.room}` : ''].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              <View style={styles.metricsRow}>
                <Metric label="Estudiantes" value={c.studentsCount} styles={styles} />
                <Metric label="Sesiones" value={c.sessionsCount} styles={styles} />
                <Metric
                  label="Asistencia"
                  value={c.attendance?.rate != null ? `${c.attendance.rate} %` : '—'}
                  styles={styles}
                  tone={c.attendance?.rate != null && c.attendance.rate < 70 ? COLORS.dangerStrong : null}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <ClassDetailModal cls={selected} onClose={() => setSelected(null)} styles={styles} COLORS={COLORS} />
    </View>
  );
}

function Metric({ label, value, styles, tone }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, tone ? { color: tone } : null]}>{value ?? 0}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ClassDetailModal({ cls, onClose, styles, COLORS }) {
  const lines = cls ? formatScheduleLines(cls.schedule) : [];
  const att = cls?.attendance || {};
  return (
    <Modal visible={!!cls} animationType="slide" onRequestClose={onClose}>
      {cls ? (
        <View style={styles.root}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.backBtn} accessibilityLabel="Cerrar">
              <X size={20} color={COLORS.icon} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{cls.className || 'Clase'}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {[cls.group, cls.subjectCode, cls.period ? `Periodo ${cls.period}` : ''].filter(Boolean).join(' · ') || 'Detalle de la clase'}
              </Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Docente</Text>
              <Text style={styles.detailValue}>{personDisplayName(cls.teacherName, cls.teacherEmail || 'Sin docente')}</Text>
              {cls.teacherEmail ? <Text style={styles.meta}>{cls.teacherEmail}</Text> : null}

              <View style={styles.detailRow}>
                <Calendar size={16} color={COLORS.icon} />
                <View style={{ flex: 1 }}>
                  {lines.length
                    ? lines.map((l) => <Text key={l} style={styles.detailText}>{l}</Text>)
                    : <Text style={styles.detailText}>{cls.startTime ? `${cls.startTime} – ${cls.endTime || ''}` : 'Sin horario'}</Text>}
                </View>
              </View>
              {cls.room ? (
                <View style={styles.detailRow}>
                  <MapPin size={16} color={COLORS.icon} />
                  <Text style={styles.detailText}>Salón {cls.room}</Text>
                </View>
              ) : null}
              <Text style={[styles.meta, { marginTop: 10 }]}>
                {cls.lastSessionDate
                  ? `Última sesión: ${colombiaDateLongFromYmd(cls.lastSessionDate)} · ${cls.sessionsCount} en total`
                  : 'Todavía no se ha tomado asistencia.'}
              </Text>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Asistencia acumulada</Text>
              {att.total ? (
                <View style={styles.metricsRow}>
                  <Metric label="Presentes" value={att.asistencia} styles={styles} tone={COLORS.successStrong} />
                  <Metric label="Retardos" value={att.retardo} styles={styles} tone={COLORS.warningStrong} />
                  <Metric label="Ausencias" value={att.inasistencia} styles={styles} tone={COLORS.dangerStrong} />
                </View>
              ) : (
                <Text style={styles.detailText}>Sin registros todavía.</Text>
              )}
            </View>

            <View style={styles.detailCard}>
              <View style={styles.rosterHead}>
                <Users size={16} color={COLORS.icon} />
                <Text style={styles.detailLabel}>Estudiantes inscritos ({cls.studentsCount})</Text>
              </View>
              {classProgramLabels(cls).length > 1 ? (
                <Text style={[styles.meta, { marginBottom: 8 }]}>
                  Esta clase reúne {classProgramLabels(cls).length} carreras: {classProgramLabels(cls).join(', ')}.
                </Text>
              ) : null}
              {(cls.students || []).length === 0 ? (
                <Text style={styles.detailText}>Nadie se ha unido a esta clase.</Text>
              ) : (
                cls.students.map((s, i) => (
                  <View key={s.email || i} style={[styles.studentRow, i > 0 ? styles.studentDivider : null]}>
                    <Text style={styles.studentName}>{personDisplayName(s.name, s.email || 'Estudiante')}</Text>
                    <Text style={styles.meta}>
                      {[s.code, prettyLabel(s.program, ''), s.semester ? `Semestre ${String(s.semester).match(/\d+/)?.[0] || s.semester}` : '', s.email].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.card, paddingTop: headerTop(12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.surface },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  body: { padding: 16, paddingBottom: 32, gap: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: COLORS.text },
  pillsRow: { gap: 8 },
  filterHint: { color: COLORS.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  programLine: { marginTop: 8, color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.muted, fontWeight: '900', fontSize: 12 },
  pillTextActive: { color: COLORS.white },
  error: { color: COLORS.danger, fontWeight: '700' },
  empty: { color: COLORS.textSecondary, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  className: { fontWeight: '900', color: COLORS.text },
  meta: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  code: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, backgroundColor: COLORS.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  schedule: { marginTop: 10, color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metric: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  metricValue: { fontWeight: '900', color: COLORS.text, fontSize: 16, fontVariant: ['tabular-nums'] },
  metricLabel: { marginTop: 2, color: COLORS.muted, fontSize: 11 },
  detailCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  detailLabel: { fontWeight: '900', color: COLORS.textSecondary, fontSize: 12 },
  detailValue: { marginTop: 4, fontWeight: '900', color: COLORS.text, fontSize: 16 },
  detailRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'flex-start' },
  detailText: { color: COLORS.text, lineHeight: 20 },
  rosterHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  studentRow: { paddingVertical: 8 },
  studentDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  studentName: { fontWeight: '800', color: COLORS.text },
});
