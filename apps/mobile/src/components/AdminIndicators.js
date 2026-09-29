import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Activity,
  BookOpen,
  FileText,
  GraduationCap,
  TrendingUp,
  Users,
} from 'lucide-react-native';

import { useColors } from '../ui/ThemeContext';

function fmt(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return String(value);
}

export default function AdminIndicators({ data, loading, navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

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

  return (
    <View>
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
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  sectionTitle: { fontWeight: '900', color: COLORS.textSecondary },
  sectionHint: { marginTop: 4, marginBottom: 12, color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', backgroundColor: COLORS.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statTitle: { fontSize: 12, color: COLORS.muted, fontWeight: '800' },
  statValue: { marginTop: 6, fontSize: 22, fontWeight: '900', color: COLORS.text },
  statHint: { marginTop: 6, fontSize: 11, color: COLORS.placeholder, fontWeight: '700' },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  loadingBox: { marginTop: 18, alignItems: 'center', gap: 8 },
});
