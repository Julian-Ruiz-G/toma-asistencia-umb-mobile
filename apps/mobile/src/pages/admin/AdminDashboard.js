import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Activity,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  GraduationCap,
  LogOut,
  Menu,
  QrCode,
  ScanFace,
  ShieldCheck,
  TrendingUp,
  Upload,
  UserX,
  Users,
} from 'lucide-react-native';

import { useAdminDrawer } from '../../components/AdminDrawer';
import RequestConsentsModal from '../../components/RequestConsentsModal';
import { useColors } from '../../ui/ThemeContext';
import { useAuth } from '../../state/auth';
import { fetchAdminDashboard } from '../../utils/adminDashboard';

export default function AdminDashboard({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken, logout } = useAuth();
  const { drawer, openDrawer } = useAdminDrawer(navigation, 'AdminDashboard');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showConsents, setShowConsents] = useState(false);

  const load = useCallback(async () => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchAdminDashboard(authToken, { force: true });
      setData(next);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const statsCards = useMemo(
    () => [
      {
        key: 'students',
        title: 'Estudiantes',
        value: fmt(data?.students?.total),
        hint: data ? `${data.students.withFace} con rostro` : 'Toca para analizar',
        Icon: GraduationCap,
      },
      {
        key: 'teachers',
        title: 'Docentes',
        value: fmt(data?.teachers?.total),
        hint: data ? `${data.teachers.withClasses} con clases` : 'Toca para analizar',
        Icon: Users,
      },
      {
        key: 'attendance',
        title: 'Asistencia hoy',
        value: fmt(data?.attendance?.markedToday),
        hint: data ? `${data.attendance.presentToday} presentes` : 'Toca para analizar',
        Icon: Activity,
      },
      {
        key: 'reports',
        title: 'Sesiones hoy',
        value: fmt(data?.reportsTotal),
        hint: 'QR y reconocimiento',
        Icon: TrendingUp,
      },
      {
        key: 'classes',
        route: 'AdminClasses',
        title: 'Clases',
        value: fmt(data?.classesTotal),
        hint: 'Ver horarios y listas',
        Icon: BookOpen,
      },
      {
        key: 'justifications',
        route: 'AdminJustifications',
        title: 'Justificaciones',
        value: fmt(data?.justifications?.total),
        hint: data ? `${data.justifications.pending} por revisar` : 'Excusas de faltas',
        Icon: FileText,
      },
    ],
    [data]
  );

  const sessionsWithoutPhoto = useMemo(
    () => (data?.sessions?.todayList || []).filter((s) => !s.hasPhoto).length,
    [data]
  );

  // Pendientes que el admin puede atender: solo se muestran los que tienen algo.
  const alerts = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: 'justifications',
        count: data.justifications.pending,
        label: 'Justificaciones sin revisar',
        detail: 'Los docentes aún no las aprueban ni rechazan',
        Icon: FileText,
        onPress: () => navigation.navigate('AdminJustifications'),
      },
      {
        key: 'consents',
        count: data.consents.pending,
        label: 'Consentimientos pendientes',
        detail: `${data.consents.studentsPending} estudiantes · ${data.consents.teachersPending} docentes`,
        Icon: ShieldCheck,
        onPress: () => navigation.navigate('AdminConsents'),
      },
      {
        key: 'noFace',
        count: data.students.withoutFace,
        label: 'Estudiantes sin rostro registrado',
        detail: 'No pueden ser reconocidos en la foto de clase',
        Icon: ScanFace,
        onPress: () => navigation.navigate('AdminStudents'),
      },
      {
        key: 'noClasses',
        count: data.teachers.withoutClasses,
        label: 'Docentes sin clases',
        detail: 'Asígnales asignaturas con la carga masiva',
        Icon: UserX,
        onPress: () => navigation.navigate('AdminTeachers'),
      },
      {
        key: 'noPhoto',
        count: sessionsWithoutPhoto,
        label: 'Sesiones de hoy sin foto',
        detail: 'La asistencia aún no está confirmada con reconocimiento',
        Icon: Camera,
        onPress: () => navigation.navigate('AdminInsight', { section: 'reports' }),
      },
    ].filter((a) => Number(a.count) > 0);
  }, [data, navigation, sessionsWithoutPhoto]);

  const quickActions = useMemo(
    () => [
      { key: 'consents', label: 'Pedir consentimientos', Icon: ShieldCheck, onPress: () => setShowConsents(true) },
      { key: 'classes', label: 'Ver clases', Icon: BookOpen, onPress: () => navigation.navigate('AdminClasses') },
      { key: 'bulk', label: 'Carga masiva', Icon: Upload, onPress: () => navigation.navigate('AdminBulkUpload') },
      { key: 'qr', label: 'QR institucional', Icon: QrCode, onPress: () => navigation.navigate('AdminQrInstitutional') },
    ],
    [navigation]
  );

  const today = data?.attendance;
  const todayTotal = today ? today.presentToday + today.lateToday + today.absentToday : 0;
  const todaySessions = data?.sessions?.todayList || [];

  return (
    <View style={styles.root}>
      {drawer}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.userRow}>
              <Pressable onPress={openDrawer} style={styles.menuBtn} accessibilityLabel="Abrir menú">
                <Menu size={22} color={COLORS.white} />
              </Pressable>
              <View>
                <Text style={styles.headerTitle}>Tablero</Text>
                <Text style={styles.headerSub}>Resumen institucional</Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                logout();
                navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
              }}
              style={styles.logoutBtn}
              accessibilityLabel="Cerrar sesión"
            >
              <LogOut size={18} color={COLORS.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Indicadores</Text>
          <Text style={styles.sectionHint}>Toca una tarjeta para ver el detalle.</Text>
          <View style={styles.grid2}>
            {statsCards.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => (c.route ? navigation.navigate(c.route) : navigation.navigate('AdminInsight', { section: c.key }))}
                style={styles.statCard}
              >
                <View style={styles.statTop}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.statTitle}>{c.title}</Text>
                    <Text style={styles.statValue}>{c.value}</Text>
                    <Text numberOfLines={1} style={styles.statHint}>{c.hint}</Text>
                  </View>
                  <View style={styles.statIconWrap}>
                    <c.Icon size={18} color={COLORS.icon} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          {loading && !data ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.sectionHint}>Cargando cifras…</Text>
            </View>
          ) : null}

          {data ? (
            <>
              <Text style={[styles.sectionTitle, styles.sectionGap]}>Requiere atención</Text>
              <View style={styles.listCard}>
                {alerts.length === 0 ? (
                  <View style={styles.allGood}>
                    <CheckCircle2 size={18} color={COLORS.successStrong} />
                    <Text style={styles.allGoodText}>Todo al día: no hay pendientes.</Text>
                  </View>
                ) : (
                  alerts.map((a, i) => (
                    <Pressable
                      key={a.key}
                      onPress={a.onPress}
                      style={[styles.alertRow, i < alerts.length - 1 ? styles.rowDivider : null]}
                    >
                      <View style={styles.alertIcon}>
                        <a.Icon size={18} color={COLORS.warningStrong} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.alertLabel}>{a.label}</Text>
                        <Text style={styles.alertDetail} numberOfLines={1}>{a.detail}</Text>
                      </View>
                      <Text style={styles.alertCount}>{a.count}</Text>
                      <ChevronRight size={16} color={COLORS.placeholder} />
                    </Pressable>
                  ))
                )}
              </View>

              <Text style={[styles.sectionTitle, styles.sectionGap]}>Hoy</Text>
              <View style={styles.listCard}>
                <View style={styles.todayBlock}>
                  <Text style={styles.todayLabel}>Asistencia registrada</Text>
                  {todayTotal > 0 ? (
                    <>
                      <View style={styles.bar}>
                        <View style={[styles.barPart, { flex: today.presentToday, backgroundColor: COLORS.successStrong }]} />
                        <View style={[styles.barPart, { flex: today.lateToday, backgroundColor: COLORS.warningStrong }]} />
                        <View style={[styles.barPart, { flex: today.absentToday, backgroundColor: COLORS.dangerStrong }]} />
                      </View>
                      <View style={styles.legendRow}>
                        <Legend color={COLORS.successStrong} text={`${today.presentToday} presentes`} styles={styles} />
                        <Legend color={COLORS.warningStrong} text={`${today.lateToday} retardos`} styles={styles} />
                        <Legend color={COLORS.dangerStrong} text={`${today.absentToday} ausentes`} styles={styles} />
                      </View>
                    </>
                  ) : (
                    <Text style={styles.muted}>Aún no hay asistencia registrada hoy.</Text>
                  )}
                </View>

                <View style={[styles.todayBlock, styles.blockDivider]}>
                  <Text style={styles.todayLabel}>Sesiones ({todaySessions.length})</Text>
                  {todaySessions.length === 0 ? (
                    <Text style={styles.muted}>No se ha abierto ninguna sesión hoy.</Text>
                  ) : (
                    todaySessions.slice(0, 5).map((s) => (
                      <View key={s.sessionId || `${s.classId}-${s.group}`} style={styles.sessionRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sessionName} numberOfLines={1}>
                            {s.className || 'Clase'}{s.group ? ` · ${s.group}` : ''}
                          </Text>
                          <Text style={styles.sessionMeta} numberOfLines={1}>{s.teacherEmail || 'Docente'}</Text>
                        </View>
                        <Text style={[styles.photoTag, s.hasPhoto ? styles.photoTagOk : styles.photoTagPending]}>
                          {s.hasPhoto ? `Foto · ${s.recognized} reconocidos` : 'Sin foto'}
                        </Text>
                      </View>
                    ))
                  )}
                  {todaySessions.length > 5 ? (
                    <Pressable onPress={() => navigation.navigate('AdminInsight', { section: 'reports' })}>
                      <Text style={styles.link}>Ver las {todaySessions.length} sesiones</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <Text style={[styles.sectionTitle, styles.sectionGap]}>Acciones rápidas</Text>
              <View style={styles.grid2}>
                {quickActions.map((q) => (
                  <Pressable key={q.key} onPress={q.onPress} style={styles.actionCard}>
                    <View style={styles.actionIcon}>
                      <q.Icon size={18} color={COLORS.primary} />
                    </View>
                    <Text style={styles.actionLabel}>{q.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <RequestConsentsModal
        visible={showConsents}
        onClose={() => setShowConsents(false)}
        pending={data?.consents}
      />
    </View>
  );
}

function Legend({ color, text, styles }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

function fmt(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return String(value);
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 18 },
  header: { backgroundColor: COLORS.primary, paddingTop: 54, paddingHorizontal: 24, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 12 },
  menuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontSize: 20, fontWeight: '900' },
  headerSub: { marginTop: 2, color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700' },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 26 },
  sectionTitle: { fontWeight: '900', color: COLORS.textSecondary },
  sectionGap: { marginTop: 22, marginBottom: 10 },
  sectionHint: { marginTop: 4, marginBottom: 12, color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', backgroundColor: COLORS.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statTitle: { fontSize: 12, color: COLORS.muted, fontWeight: '800' },
  statValue: { marginTop: 6, fontSize: 22, fontWeight: '900', color: COLORS.text },
  statHint: { marginTop: 6, fontSize: 11, color: COLORS.placeholder, fontWeight: '700' },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  loadingBox: { marginTop: 18, alignItems: 'center', gap: 8 },
  listCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  allGood: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  allGoodText: { color: COLORS.textSecondary, fontWeight: '700' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  alertIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.warningBg },
  alertLabel: { fontWeight: '800', color: COLORS.text },
  alertDetail: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  alertCount: { fontWeight: '900', color: COLORS.text, fontSize: 16, fontVariant: ['tabular-nums'] },
  todayBlock: { padding: 14 },
  blockDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  todayLabel: { fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, backgroundColor: COLORS.surface },
  barPart: { height: '100%' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  muted: { color: COLORS.muted },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  sessionName: { fontWeight: '800', color: COLORS.text },
  sessionMeta: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  photoTag: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  photoTagOk: { backgroundColor: COLORS.successBg, color: COLORS.success },
  photoTagPending: { backgroundColor: COLORS.warningBg, color: COLORS.warning },
  link: { marginTop: 6, color: COLORS.primary, fontWeight: '800' },
  actionCard: { width: '48%', backgroundColor: COLORS.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  actionLabel: { flex: 1, fontWeight: '800', color: COLORS.text, fontSize: 13 },
});
