import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Clock,
  GraduationCap,
  LogOut,
  QrCode,
  TrendingUp,
  Users,
} from 'lucide-react-native';

import { COLORS } from '../../ui/theme';
import { ADMIN_DASHBOARD_STATS_URL } from '../../config';
import { useAuth } from '../../state/auth';

export default function AdminDashboard({ navigation }) {
  const { authToken, logout } = useAuth();
  const [stats, setStats] = useState({
    studentsTotal: null,
    teachersTotal: null,
    attendanceToday: null,
    reportsTotal: null,
  });

  useEffect(() => {
    (async () => {
      try {
        if (!authToken) return;
        if (!ADMIN_DASHBOARD_STATS_URL) return;
        const resp = await fetch(ADMIN_DASHBOARD_STATS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({}),
        });
        const text = await resp.text();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }
        if (!resp.ok) return;

        setStats({
          studentsTotal: Number(json?.students?.total ?? null),
          teachersTotal: Number(json?.teachers?.total ?? null),
          attendanceToday: Number(json?.attendance?.markedToday ?? null),
          reportsTotal: Number(json?.reports?.total ?? null),
        });
      } catch {
        // ignore
      }
    })();
  }, [authToken]);

  const statsCards = useMemo(
    () => [
      {
        title: 'Estudiantes activos',
        value: stats.studentsTotal == null || Number.isNaN(stats.studentsTotal) ? '—' : String(stats.studentsTotal),
        change: '',
        trend: 'up',
        color: COLORS.primary,
        Icon: GraduationCap,
      },
      {
        title: 'Docentes activos',
        value: stats.teachersTotal == null || Number.isNaN(stats.teachersTotal) ? '—' : String(stats.teachersTotal),
        change: '',
        trend: 'up',
        color: '#16A34A',
        Icon: Users,
      },
      {
        title: 'Asistencias hoy',
        value: stats.attendanceToday == null || Number.isNaN(stats.attendanceToday) ? '—' : String(stats.attendanceToday),
        change: '',
        trend: 'up',
        color: '#2563EB',
        Icon: Activity,
      },
      {
        title: 'Reportes',
        value: stats.reportsTotal == null || Number.isNaN(stats.reportsTotal) ? '—' : String(stats.reportsTotal),
        change: '',
        trend: 'up',
        color: '#7C3AED',
        Icon: TrendingUp,
      },
    ],
    [stats]
  );

  const quickActions = useMemo(
    () => [
      { label: 'Ver Estudiantes', Icon: GraduationCap, bg: '#DBEAFE', fg: '#2563EB', onPress: () => navigation.navigate('AdminStudents') },
      { label: 'Ver Docentes', Icon: Users, bg: '#DCFCE7', fg: '#16A34A', onPress: () => navigation.navigate('AdminTeachers') },
      { label: 'Carga Masiva', Icon: Calendar, bg: '#F3E8FF', fg: '#7C3AED', onPress: () => navigation.navigate('AdminBulkUpload') },
      { label: 'Generar QR', Icon: QrCode, bg: '#FFEDD5', fg: '#EA580C', onPress: () => navigation.navigate('AdminQrInstitutional') },
      { label: 'Ver Logs', Icon: Activity, bg: '#FEE2E2', fg: '#DC2626', onPress: () => navigation.navigate('AdminLogs') },
      { label: 'Auditoría', Icon: TrendingUp, bg: '#E0E7FF', fg: '#4F46E5', onPress: () => navigation.navigate('AdminAudit') },
      { label: 'Consentimientos', Icon: Clock, bg: '#FCE7F3', fg: '#DB2777', onPress: () => navigation.navigate('AdminConsents') },
    ],
    [navigation]
  );

  const TrendIcon = (trend) => (trend === 'up' ? ArrowUpRight : ArrowDownRight);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>Panel administrativo</Text>
          </View>
          <Pressable
            onPress={() => {
              logout();
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }}
            style={styles.logoutBtn}
          >
            <LogOut size={16} color="#DC2626" />
            <Text style={styles.logoutText}>Salir</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.grid2}>
          {statsCards.map((c, idx) => {
            const TIcon = TrendIcon(c.trend);
            return (
              <View key={idx} style={styles.statCard}>
                <View style={styles.statTop}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.statTitle}>{c.title}</Text>
                    <Text style={styles.statValue}>{c.value}</Text>
                    <View style={styles.trendRow}>
                      <TIcon size={14} color={c.trend === 'up' ? '#16A34A' : '#DC2626'} />
                      <Text style={[styles.trendText, { color: c.trend === 'up' ? '#16A34A' : '#DC2626' }]}>{c.change}</Text>
                    </View>
                  </View>
                  <View style={[styles.statIconWrap, { backgroundColor: c.color }]}>
                    <c.Icon size={18} color="#fff" />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: 14 }} />

        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        <View style={styles.quickGrid}>
          {quickActions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} style={styles.quickCard}>
              <View style={[styles.quickIcon, { backgroundColor: a.bg }]}>
                <a.Icon size={18} color={a.fg} />
              </View>
              <Text style={styles.quickText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  headerSubtitle: { marginTop: 4, color: '#6B7280' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  logoutText: { color: '#DC2626', fontWeight: '900' },
  body: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 26 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statTitle: { fontSize: 12, color: '#6B7280' },
  statValue: { marginTop: 6, fontSize: 18, fontWeight: '900', color: '#111827' },
  trendRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendText: { fontWeight: '800' },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontWeight: '900', color: '#374151' },
  quickGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: { width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontWeight: '900', color: '#111827', flex: 1, fontSize: 12 },
});
