import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, ChevronRight, MapPin, UserPlus, Users } from 'lucide-react-native';

import { AdminNavButtons, useAdminDrawer } from '../../components/AdminDrawer';
import { MenuButton } from '../../components/RoleDrawer';
import { ADMIN_CLASSES_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { useColors } from '../../ui/ThemeContext';
import { headerTop } from '../../ui/safeArea';
import { prettyLabel } from '../../utils/adminDashboard';
import { personDisplayName } from '../../utils/displayName';
import { colombiaDateLongFromYmd } from '../../utils/formatDateTime';
import { classProgramLabels } from '../../utils/programs';
import { formatScheduleLines } from '../../utils/schedule';

/** Detalle de una clase para el admin: datos, inscritos y acceso para inscribir estudiantes. */
export default function ClaseDetallePage({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useAdminDrawer(navigation, 'AdminClassDetail');
  const { authToken } = useAuth();
  const classId = String(route?.params?.classId || '');

  const [cls, setCls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Se recarga al volver de "Agregar estudiantes" para mostrar los nuevos inscritos.
  const load = useCallback(async () => {
    if (!authToken || !classId || !ADMIN_CLASSES_URL) return;
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
      if (!resp.ok) throw new Error(json?.message || json?.error || `HTTP ${resp.status}`);
      const found = (json?.classes || []).find((c) => String(c.classId) === classId) || null;
      if (!found) throw new Error('La clase ya no existe.');
      setCls(found);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la clase.');
    } finally {
      setLoading(false);
    }
  }, [authToken, classId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const lines = cls ? formatScheduleLines(cls.schedule) : [];
  const att = cls?.attendance || {};
  const programs = cls ? classProgramLabels(cls) : [];
  const students = cls?.students || [];

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <AdminNavButtons onBack={goBack} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{cls?.className || 'Clase'}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {cls ? ([cls.group, cls.subjectCode, cls.period ? `Periodo ${cls.period}` : ''].filter(Boolean).join(' · ') || 'Detalle de la clase') : 'Detalle de la clase'}
          </Text>
        </View>
        <MenuButton onPress={openDrawer} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading && !cls ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {cls ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Docente</Text>
              <Text style={styles.value}>{personDisplayName(cls.teacherName, cls.teacherEmail || 'Sin docente')}</Text>
              {cls.teacherEmail ? <Text style={styles.meta}>{cls.teacherEmail}</Text> : null}
              <View style={styles.row}>
                <Calendar size={16} color={COLORS.icon} />
                <View style={{ flex: 1 }}>
                  {lines.length
                    ? lines.map((l) => <Text key={l} style={styles.text}>{l}</Text>)
                    : <Text style={styles.text}>{cls.startTime ? `${cls.startTime} – ${cls.endTime || ''}` : 'Sin horario'}</Text>}
                </View>
              </View>
              {cls.room ? (
                <View style={styles.row}>
                  <MapPin size={16} color={COLORS.icon} />
                  <Text style={styles.text}>Salón {cls.room}</Text>
                </View>
              ) : null}
              <Text style={[styles.meta, { marginTop: 10 }]}>
                {cls.lastSessionDate
                  ? `Última sesión: ${colombiaDateLongFromYmd(cls.lastSessionDate)} · ${cls.sessionsCount} en total`
                  : 'Todavía no se ha tomado asistencia.'}
              </Text>
            </View>

            <Pressable
              onPress={() => navigation.navigate('AdminClassAddStudents', {
                classId,
                className: [cls.className, cls.group].filter(Boolean).join(' · ') || 'la clase',
              })}
              style={styles.addCard}
              accessibilityRole="button"
            >
              <View style={styles.addIcon}>
                <UserPlus size={20} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addTitle}>Agregar estudiantes</Text>
                <Text style={styles.addText}>Ver todos los estudiantes y buscarlos por nombre, correo o CC.</Text>
              </View>
              <ChevronRight size={18} color={COLORS.white} />
            </Pressable>

            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <Users size={16} color={COLORS.icon} />
                <Text style={styles.label}>Estudiantes inscritos ({students.length})</Text>
              </View>
              {programs.length > 1 ? (
                <Text style={[styles.meta, { marginBottom: 8 }]}>
                  Esta clase reúne {programs.length} carreras: {programs.join(', ')}.
                </Text>
              ) : null}
              {students.length === 0 ? (
                <Text style={styles.text}>Nadie se ha unido a esta clase.</Text>
              ) : (
                students.map((s, i) => (
                  <View key={s.email || i} style={[styles.studentRow, i > 0 ? styles.divider : null]}>
                    <Text style={styles.name}>{personDisplayName(s.name, s.email || 'Estudiante')}</Text>
                    <Text style={styles.meta}>
                      {[s.code ? `CC ${s.code}` : '', prettyLabel(s.program, ''), s.semester ? `Semestre ${String(s.semester).match(/\d+/)?.[0] || s.semester}` : '', s.email].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Asistencia acumulada</Text>
              {att.total ? (
                <View style={styles.metricsRow}>
                  <Metric label="Presentes" value={att.asistencia} styles={styles} tone={COLORS.successStrong} />
                  <Metric label="Retardos" value={att.retardo} styles={styles} tone={COLORS.warningStrong} />
                  <Metric label="Ausencias" value={att.inasistencia} styles={styles} tone={COLORS.dangerStrong} />
                </View>
              ) : (
                <Text style={[styles.text, { marginTop: 6 }]}>Sin registros todavía.</Text>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
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

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.card,
    paddingTop: headerTop(12),
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.surface },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  body: { padding: 16, paddingBottom: 32, gap: 12 },
  error: { color: COLORS.dangerStrong, fontWeight: '700' },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  label: { fontWeight: '900', color: COLORS.textSecondary, fontSize: 12 },
  value: { marginTop: 4, fontWeight: '900', color: COLORS.text, fontSize: 16 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'flex-start' },
  text: { color: COLORS.text, lineHeight: 20 },
  meta: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 14,
  },
  addIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTitle: { color: COLORS.white, fontWeight: '900', fontSize: 15 },
  addText: { marginTop: 2, color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  studentRow: { paddingVertical: 8 },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  name: { fontWeight: '800', color: COLORS.text },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metric: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  metricValue: { fontWeight: '900', color: COLORS.text, fontSize: 16, fontVariant: ['tabular-nums'] },
  metricLabel: { marginTop: 2, color: COLORS.muted, fontSize: 11 },
});
