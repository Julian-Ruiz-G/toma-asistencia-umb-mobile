import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronRight, Search } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ADMIN_CLASSES_URL } from '../../config';
import { DonutChart, FilterChips, HBarChart, MiniLine, WeekBars } from '../../components/MiniCharts';
import { DrillModal, buildInsightDrill, semesterTitle } from '../../components/AdminInsightDrill';
import { useColors } from '../../ui/ThemeContext';
import { useAuth } from '../../state/auth';
import { personDisplayName } from '../../utils/displayName';
import { fetchAdminDashboard, filterAttendanceRows, labelKey, lastNDayBuckets, prettyLabel, weekdayShort } from '../../utils/adminDashboard';
import { AdminNavButtons, useAdminDrawer } from '../../components/AdminDrawer';

const SECTIONS = {
  students: {
    title: 'Estudiantes',
    subtitle: 'Distribución institucional por carrera y semestre',
  },
  teachers: {
    title: 'Docentes',
    subtitle: 'Carga académica y distribución por período',
  },
  attendance: {
    title: 'Asistencia',
    subtitle: 'Filtra por día, semana, corte o semestre',
  },
  reports: {
    title: 'Sesiones de asistencia',
    subtitle: 'Aperturas de clase, foto grupal y reconocimiento facial',
  },
};

export default function AdminInsight({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useAdminDrawer(navigation, 'AdminInsight');
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
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [attGroup, setAttGroup] = useState('program');
  const [drill, setDrill] = useState(null);
  const [classList, setClassList] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchAdminDashboard(authToken);
      setData(next);
      if (authToken && ADMIN_CLASSES_URL) {
        try {
          const resp = await fetch(ADMIN_CLASSES_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({}),
          });
          const json = await resp.json().catch(() => null);
          if (resp.ok) setClassList(Array.isArray(json?.classes) ? json.classes : []);
        } catch {
          setClassList([]);
        }
      }
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

  const filteredStudents = useMemo(() => students.filter((s) => {
    if (program && labelKey(s.program) !== program) return false;
    if (semester && labelKey(s.semester) !== semester) return false;
    return true;
  }), [students, program, semester]);

  const filteredTeachers = useMemo(() => teachers.filter((t) => {
    if (load === 'with' && t.subjectsCount <= 0) return false;
    if (load === 'without' && t.subjectsCount > 0) return false;
    if (period && !(t.periods || []).some((p) => labelKey(p) === period)) return false;
    return true;
  }), [teachers, load, period]);

  // El buscador filtra los indicadores y gráficos de asistencia por estudiante o clase.
  const filteredAttendance = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rangedAttendance;
    return rangedAttendance.filter((r) =>
      [r.studentName, r.studentEmail, r.className, r.program, r.semester].join(' ').toLowerCase().includes(q)
    );
  }, [rangedAttendance, query]);

  const studentCharts = useMemo(() => ({
    byProgram: countLocal(filteredStudents, (s) => s.program),
    bySemester: countLocal(filteredStudents, (s) => s.semester),
  }), [filteredStudents]);

  const teacherCharts = useMemo(() => ({
    byTeacher: filteredTeachers
      .slice()
      .sort((a, b) => b.subjectsCount - a.subjectsCount)
      .slice(0, 8)
      .map((t) => ({
        label: personDisplayName(t.fullName, String(t.email || '').split('@')[0] || 'Docente'),
        count: t.subjectsCount,
        email: t.email,
      })),
    byPeriod: countLocal(filteredTeachers.flatMap((t) => t.periods || [])),
  }), [filteredTeachers]);

  const weekDays = useMemo(() => {
    if (attRange === 'corte' || attRange === 'semester') {
      return lastNDayBuckets(filteredAttendance, data?.date, 7);
    }
    const days = (data?.attendance?.last7Days || []).map((d) => ({
      ...d,
      label: weekdayShort(d.date),
    }));
    return days.length ? days : lastNDayBuckets(filteredAttendance, data?.date, 7);
  }, [data, filteredAttendance, attRange]);

  const selectedBucket = useMemo(
    () => weekDays.find((d) => String(d.date) === String(selectedDay)) || null,
    [weekDays, selectedDay]
  );

  const dayRows = useMemo(() => {
    if (!selectedDay) return filteredAttendance;
    const rows = filteredAttendance.filter((r) => String(r.date || '') === String(selectedDay));
    return rows;
  }, [filteredAttendance, selectedDay]);

  const categoryRows = useMemo(() => {
    let rows = dayRows;
    if (attGroup === 'program' && selectedProgram) {
      rows = rows.filter((r) => prettyLabel(r.program) === selectedProgram);
    }
    if (attGroup === 'semester' && selectedSemester) {
      rows = rows.filter((r) => semesterTitle(r.semester) === selectedSemester);
    }
    return rows;
  }, [dayRows, attGroup, selectedProgram, selectedSemester]);

  const rankingRows = useMemo(() => {
    if (!selectedStatus) return dayRows;
    return dayRows.filter((r) => r.status === selectedStatus);
  }, [dayRows, selectedStatus]);

  const statusSource = categoryRows;
  const statusCounts = useMemo(() => {
    if (selectedDay && selectedBucket && !dayRows.length && !selectedProgram && !selectedSemester) {
      return {
        present: Number(selectedBucket.asistencia) || 0,
        late: Number(selectedBucket.retardo) || 0,
        absent: Number(selectedBucket.inasistencia) || 0,
      };
    }
    return {
      present: statusSource.filter((r) => r.status === 'asistencia').length,
      late: statusSource.filter((r) => r.status === 'retardo').length,
      absent: statusSource.filter((r) => r.status === 'inasistencia').length,
    };
  }, [selectedDay, selectedBucket, dayRows, statusSource]);

  const attStats = useMemo(() => ({
    present: statusCounts.present,
    late: statusCounts.late,
    absent: statusCounts.absent,
    byProgram: countLocal(rankingRows, (r) => r.program),
    bySemester: countLocal(rankingRows, (r) => r.semester),
  }), [statusCounts, rankingRows]);

  const sessionPoints = useMemo(() => {
    const fromSessions = (data?.sessions?.last7Days || [])
      .map((d) => ({
        date: String(d.date || ''),
        count: Number(d.count) || 0,
        label: weekdayShort(d.date),
      }))
      .filter((d) => d.date);
    if (fromSessions.length) return fromSessions;
    return (data?.attendance?.last7Days || []).map((d) => ({
      date: d.date,
      count: Number(d.sessions) || 0,
      label: weekdayShort(d.date),
    }));
  }, [data]);

  const studentSemesterBars = useMemo(
    () => sortSemesters(studentCharts.bySemester),
    [studentCharts.bySemester]
  );
  const attendanceSemesterBars = useMemo(
    () => sortSemesters(attStats.bySemester),
    [attStats.bySemester]
  );

  const statusSegments = [
    { key: 'asistencia', label: 'Asistencia', value: attStats.present, color: COLORS.successStrong },
    { key: 'retardo', label: 'Retardo', value: attStats.late, color: COLORS.warningStrong },
    { key: 'inasistencia', label: 'Inasistencia', value: attStats.absent, color: COLORS.dangerStrong },
  ];

  const focusHint = [
    selectedBucket ? selectedBucket.label : null,
    selectedStatus === 'asistencia' ? 'asistencia' : selectedStatus === 'retardo' ? 'retardo' : selectedStatus === 'inasistencia' ? 'inasistencia' : null,
    attGroup === 'program' ? selectedProgram : selectedSemester,
  ].filter(Boolean).join(' · ');

  const todaySessions = data?.sessions?.todayList || [];
  const photoToday = useMemo(() => {
    const withPhoto = todaySessions.filter((s) => s.hasPhoto);
    return {
      opened: todaySessions.length,
      withPhoto: withPhoto.length,
      withoutPhoto: todaySessions.filter((s) => !s.hasPhoto).length,
      recognized: withPhoto.reduce((n, s) => n + (Number(s.recognized) || 0), 0),
      unrecognized: withPhoto.reduce((n, s) => n + (Number(s.unrecognized) || 0), 0),
      faces: withPhoto.reduce((n, s) => n + (Number(s.facesDetected) || 0), 0),
    };
  }, [todaySessions]);
  const photoMatchTotal = photoToday.recognized + photoToday.unrecognized;
  const photoPct = photoMatchTotal > 0 ? Math.round((photoToday.recognized / photoMatchTotal) * 100) : 0;
  const photoChart = [
    { key: 'recognized', label: 'Estudiantes reconocidos', count: photoToday.recognized },
    { key: 'unrecognized', label: 'Rostros sin identificar', count: photoToday.unrecognized },
    { key: 'noPhoto', label: 'Sesiones aún sin foto', count: photoToday.withoutPhoto },
  ].filter((row) => row.count > 0);

  const manage = () => {
    if (section === 'students') navigation.navigate('AdminStudents');
    if (section === 'teachers') navigation.navigate('AdminTeachers');
  };

  const drillModel = useMemo(
    () => buildInsightDrill({
      drill,
      students,
      teachers,
      classes: classList,
      sessions: data?.sessions?.todayList || [],
      attendance: data?.attendance?.recentList || [],
    }),
    [drill, students, teachers, classList, data]
  );

  const openProgram = (label) => {
    if (!label) setDrill(null);
    else setDrill({ type: 'program', label });
  };
  const openSemester = (label) => {
    if (!label) setDrill(null);
    else setDrill({ type: 'semester', label });
  };
  const handleBack = () => {
    if (drill) {
      setDrill(null);
      return;
    }
    goBack();
  };

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <AdminNavButtons onBack={handleBack} onMenu={openDrawer} buttonStyle={styles.backBtn} size={20} color={COLORS.white} />
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
              <Card colors={COLORS} title="Estudiantes por carrera" hint="Toca una carrera para ver clases, docentes y estudiantes.">
                <FilterChips colors={COLORS} options={programOptions} value={program} onChange={setProgram} />
                <HBarChart
                  items={studentCharts.byProgram}
                  colors={COLORS}
                  collapsible
                  compact
                  labelWidth={108}
                  selectedLabel={drill?.type === 'program' ? drill.label : ''}
                  onSelect={openProgram}
                />
              </Card>
              <Card colors={COLORS} title="Estudiantes por semestre" hint="Toca un semestre para ver quién está inscrito y en qué clases.">
                <FilterChips colors={COLORS} options={semesterOptions} value={semester} onChange={setSemester} />
                <HBarChart
                  items={studentSemesterBars}
                  colors={COLORS}
                  compact
                  labelWidth={108}
                  selectedLabel={drill?.type === 'semester' ? drill.label : ''}
                  onSelect={openSemester}
                  emptyText="Aún no hay estudiantes por semestre."
                />
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
              <Card colors={COLORS} title="Docentes con y sin clases asignadas" hint="Toca un recuadro para ver el listado.">
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
                <View style={styles.summaryRow}>
                  <SummaryCell colors={COLORS} label="Total" value={filteredTeachers.length} onPress={() => setDrill({ type: 'load', key: '' })} />
                  <SummaryCell colors={COLORS} label="Con clases" value={filteredTeachers.filter((t) => t.subjectsCount > 0).length} onPress={() => setDrill({ type: 'load', key: 'with' })} />
                  <SummaryCell colors={COLORS} label="Sin clases" value={filteredTeachers.filter((t) => t.subjectsCount <= 0).length} onPress={() => setDrill({ type: 'load', key: 'without' })} />
                </View>
              </Card>
              <Card colors={COLORS} title="Clases asignadas por docente" hint="Toca un docente para ver las materias que tiene a cargo.">
                <HBarChart
                  items={teacherCharts.byTeacher}
                  colors={COLORS}
                  collapsible
                  compact
                  selectedLabel={drill?.type === 'teacher' ? drill.label : ''}
                  onSelect={(label, row) => {
                    if (row?.email) setDrill({ type: 'teacher', email: row.email, label: row.label });
                    else setDrill(null);
                  }}
                  emptyText="Ningún docente tiene clases aún."
                />
              </Card>
              {teacherCharts.byPeriod.length ? (
                <Card colors={COLORS} title="Docentes por período académico">
                  {periodOptions.length > 1 ? (
                    <FilterChips colors={COLORS} options={periodOptions} value={period} onChange={setPeriod} />
                  ) : null}
                  <HBarChart items={teacherCharts.byPeriod} colors={COLORS} compact emptyText="Aún no hay docentes agrupados por período." />
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
                <Kpi colors={COLORS} label={selectedDay ? 'Registros del día' : 'Registros'} value={categoryRows.length} />
                <Kpi colors={COLORS} label="Asistencias" value={attStats.present} />
                <Kpi colors={COLORS} label="Inasistencias" value={attStats.absent} />
              </View>
              <Card
                colors={COLORS}
                title="Evolución de asistencia"
                hint="Toca un día para filtrar el resto de esta vista."
              >
                <FilterChips
                  exclusive
                  colors={COLORS}
                  value={attRange}
                  onChange={(id) => {
                    setAttRange(id);
                    setSelectedDay('');
                    setSelectedStatus('');
                    setSelectedProgram('');
                    setSelectedSemester('');
                  }}
                  options={[
                    { id: 'day', label: 'Hoy' },
                    { id: 'week', label: 'Semana' },
                    { id: 'corte', label: 'Corte' },
                    { id: 'semester', label: 'Semestre' },
                  ]}
                />
                {attRange === 'corte' ? (
                  <FilterChips
                    exclusive
                    colors={COLORS}
                    value={attCorte}
                    onChange={setAttCorte}
                    options={[
                      { id: '1', label: 'Corte 1' },
                      { id: '2', label: 'Corte 2' },
                    ]}
                  />
                ) : null}
                <WeekBars
                  days={weekDays}
                  colors={COLORS}
                  selectedDate={selectedDay}
                  onSelect={setSelectedDay}
                />
                <View style={styles.legendRow}>
                  <LegendDot colors={COLORS} color={COLORS.successStrong} text="Asistencia" />
                  <LegendDot colors={COLORS} color={COLORS.warningStrong} text="Retardo" />
                  <LegendDot colors={COLORS} color={COLORS.dangerStrong} text="Inasistencia" />
                </View>
                {selectedBucket ? (
                  <Text style={styles.itemMeta}>
                    {selectedBucket.label}: {selectedBucket.asistencia} asistencia · {selectedBucket.retardo} retardo · {selectedBucket.inasistencia} inasistencia
                  </Text>
                ) : null}
              </Card>
              <Card
                colors={COLORS}
                title="Estado de asistencia"
                hint={focusHint ? `Filtrado: ${focusHint}` : 'Distribución del período. Toca un estado para filtrar la gráfica de abajo.'}
              >
                <DonutChart
                  segments={statusSegments}
                  colors={COLORS}
                  selectedKey={selectedStatus}
                  onSelect={setSelectedStatus}
                />
              </Card>
              <Card
                colors={COLORS}
                title="Asistencia por carrera o semestre"
                hint={selectedStatus ? `Solo registros de ${selectedStatus}` : 'Toca una barra para filtrar los registros de este período.'}
              >
                <FilterChips
                  exclusive
                  colors={COLORS}
                  value={attGroup}
                  onChange={(id) => {
                    setAttGroup(id);
                    setSelectedProgram('');
                    setSelectedSemester('');
                  }}
                  options={[
                    { id: 'program', label: 'Carrera' },
                    { id: 'semester', label: 'Semestre' },
                  ]}
                />
                {attGroup === 'semester' ? (
                  <HBarChart
                    items={attendanceSemesterBars}
                    colors={COLORS}
                    compact
                    collapsible
                    labelWidth={108}
                    selectedLabel={selectedSemester}
                    onSelect={setSelectedSemester}
                    emptyText="Cuando haya registros, aquí aparecerán los semestres."
                  />
                ) : (
                  <HBarChart
                    items={attStats.byProgram}
                    colors={COLORS}
                    compact
                    collapsible
                    labelWidth={108}
                    selectedLabel={selectedProgram}
                    onSelect={setSelectedProgram}
                    emptyText="Cuando haya registros, aquí aparecerán las carreras."
                  />
                )}
              </Card>
              {!filteredAttendance.length ? <Text style={styles.muted}>No hay registros con ese filtro.</Text> : null}
            </>
          ) : null}

          {section === 'reports' ? (
            <>
              <View style={styles.kpiRow}>
                <Kpi colors={COLORS} label="Abiertas hoy" value={photoToday.opened} />
                <Kpi colors={COLORS} label="Con foto de clase" value={photoToday.withPhoto} />
                <Kpi colors={COLORS} label="Efectividad" value={photoMatchTotal ? `${photoPct}%` : '—'} />
              </View>
              <Card
                colors={COLORS}
                title="Coincidencias del reconocimiento facial"
                hint="Efectividad: porcentaje de rostros de la foto que coincidieron con un estudiante inscrito. Toca una barra para ver las sesiones."
              >
                <HBarChart
                  items={photoChart}
                  colors={COLORS}
                  compact
                  labelWidth={128}
                  selectedLabel={drill?.type === 'photo' ? photoChart.find((r) => r.key === drill.key)?.label : ''}
                  onSelect={(label, row) => {
                    if (row?.key) setDrill({ type: 'photo', key: row.key });
                    else setDrill(null);
                  }}
                  emptyText="Cuando el docente tome la foto de clase, aquí verás cuántos estudiantes se reconocieron hoy."
                />
              </Card>
              <Card
                colors={COLORS}
                title="Sesiones de asistencia abiertas por día"
                hint="Cuántas clases abrieron toma de asistencia en los últimos 7 días."
              >
                <MiniLine
                  points={sessionPoints}
                  colors={COLORS}
                  emptyText="Aún no se ha abierto ninguna sesión de asistencia en los últimos 7 días."
                />
              </Card>
              <Text style={styles.listHeading}>Sesiones abiertas hoy</Text>
              <Text style={styles.listIntro}>
                Cada tarjeta es una clase que ya abrió asistencia. Tócala para ver si falta la foto o cuántos rostros coincidieron.
              </Text>
              {(todaySessions).map((s) => (
                <Pressable
                  key={s.sessionId || `${s.classId}-${s.teacherEmail}`}
                  onPress={() => setDrill({ type: 'session', session: s })}
                  style={styles.sessionCard}
                >
                  <View style={styles.sessionTop}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.itemTitle}>{s.className || 'Clase'}</Text>
                      <Text style={styles.itemMeta}>
                        {[s.group ? `Grupo ${s.group}` : null, s.teacherEmail || 'Docente'].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={[styles.sessionBadge, s.hasPhoto ? styles.sessionBadgeOk : styles.sessionBadgeWait]}>
                      <Text style={[styles.sessionBadgeText, s.hasPhoto ? styles.sessionBadgeTextOk : styles.sessionBadgeTextWait]}>
                        {s.hasPhoto ? 'Foto tomada' : 'Falta foto'}
                      </Text>
                    </View>
                  </View>
                  {s.hasPhoto ? (
                    <View style={styles.sessionMetrics}>
                      <SessionMetric label="Vistos" value={s.facesDetected || 0} styles={styles} />
                      <SessionMetric label="Reconocidos" value={s.recognized || 0} styles={styles} />
                      <SessionMetric label="Sin identificar" value={s.unrecognized || 0} styles={styles} />
                    </View>
                  ) : (
                    <Text style={styles.sessionHint}>El docente aún no toma la foto del salón. Sin ella no se confirma quién asistió.</Text>
                  )}
                  <View style={styles.sessionMore}>
                    <Text style={styles.link}>Ver detalle</Text>
                    <ChevronRight size={16} color={COLORS.primary} />
                  </View>
                </Pressable>
              ))}
              {!todaySessions.length ? (
                <Text style={styles.muted}>Hoy no se ha abierto ninguna sesión de asistencia.</Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}

      <DrillModal
        visible={!!drillModel}
        model={drillModel}
        colors={COLORS}
        onClose={() => setDrill(null)}
        onNavigate={(screen, params) => navigation.navigate(screen, params)}
      />
    </View>
  );
}

function sortSemesters(items) {
  return (items || [])
    .map((row) => ({
      label: semesterTitle(row.label),
      count: Number(row.count) || 0,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => {
      const na = Number(String(a.label).match(/\d+/)?.[0] || 99);
      const nb = Number(String(b.label).match(/\d+/)?.[0] || 99);
      return na - nb;
    });
}

function uniqueOpts(values, suffix) {
  const seen = new Map();
  for (const raw of values || []) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const key = labelKey(text);
    if (!key || seen.has(key)) continue;
    const label = prettyLabel(text);
    seen.set(key, { id: key, label: suffix === 'sem.' ? semesterTitle(text) : label });
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


function Kpi({ colors, label, value }) {
  return (
    <View style={[kpiStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[kpiStyles.label, { color: colors.muted }]} numberOfLines={2}>{label}</Text>
      <Text style={[kpiStyles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function Card({ colors, title, hint, children }) {
  return (
    <View style={[kpiStyles.block, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[kpiStyles.blockTitle, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[kpiStyles.blockHint, { color: colors.muted }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function SummaryCell({ colors, label, value, onPress }) {
  const Inner = onPress ? Pressable : View;
  return (
    <Inner onPress={onPress} style={[kpiStyles.summaryCell, { backgroundColor: colors.surface }]}>
      <Text style={[kpiStyles.summaryValue, { color: colors.text }]}>{value}</Text>
      <Text style={[kpiStyles.summaryLabel, { color: colors.muted }]}>{label}</Text>
    </Inner>
  );
}

function SessionMetric({ label, value, styles }) {
  return (
    <View style={styles.sessionMetric}>
      <Text style={styles.sessionMetricValue}>{value}</Text>
      <Text style={styles.sessionMetricLabel}>{label}</Text>
    </View>
  );
}

function LegendDot({ colors, color, text }) {
  return (
    <View style={kpiStyles.legendItem}>
      <View style={[kpiStyles.legendDot, { backgroundColor: color }]} />
      <Text style={[kpiStyles.legendText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
  label: { fontSize: 11, fontWeight: '800' },
  value: { marginTop: 4, fontSize: 18, fontWeight: '900' },
  block: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  blockTitle: { fontWeight: '900', fontSize: 14 },
  blockHint: { fontSize: 12, fontWeight: '700', marginTop: -4 },
  summaryCell: { flex: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '900' },
  summaryLabel: { marginTop: 4, fontSize: 11, fontWeight: '800' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '700' },
});

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 32, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: COLORS.muted, fontWeight: '700', textAlign: 'center' },
  kpiRow: { flexDirection: 'row', gap: 10 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
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
  itemCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14 },
  listHeading: { marginTop: 4, fontWeight: '900', color: COLORS.textSecondary, fontSize: 13 },
  listIntro: { marginTop: -4, color: COLORS.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  sessionCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, gap: 10 },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start' },
  sessionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  sessionBadgeOk: { backgroundColor: COLORS.successBg },
  sessionBadgeWait: { backgroundColor: COLORS.warningBg },
  sessionBadgeText: { fontSize: 11, fontWeight: '800' },
  sessionBadgeTextOk: { color: COLORS.success },
  sessionBadgeTextWait: { color: COLORS.warning },
  sessionMetrics: { flexDirection: 'row', gap: 8 },
  sessionMetric: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  sessionMetricValue: { fontWeight: '900', color: COLORS.text, fontSize: 16 },
  sessionMetricLabel: { marginTop: 2, color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  sessionHint: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  sessionMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  link: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },
  itemTitle: { fontWeight: '900', color: COLORS.text, flex: 1 },
  itemMeta: { marginTop: 4, color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  profileLine: { marginTop: 4, color: COLORS.textSecondary, fontSize: 13, fontWeight: '800' },
  manageBtn: { marginTop: 4, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  manageText: { color: COLORS.white, fontWeight: '900' },
});
