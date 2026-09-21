import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  GraduationCap,
  LogOut,
  Menu,
  QrCode,
  ShieldCheck,
  TrendingUp,
  Upload,
  User,
  Users,
} from 'lucide-react-native';

import { SideDrawer } from '../../components/SideDrawer';
import { useColors } from '../../ui/ThemeContext';
import { ADMIN_DASHBOARD_STATS_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { personDisplayName } from '../../utils/displayName';
import { loadLocalProfile } from '../../utils/sessionStore';

export default function AdminDashboard({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken, logout, fullName, email, photoUri, setPhotoUri } = useAuth();
  const [stats, setStats] = useState({
    studentsTotal: null,
    teachersTotal: null,
    attendanceToday: null,
    reportsTotal: null,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const local = await loadLocalProfile(email);
      if (local?.photoUri) setPhotoUri(String(local.photoUri));
    })();
  }, [email, setPhotoUri]);

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
        color: COLORS.icon,
        Icon: GraduationCap,
      },
      {
        title: 'Docentes activos',
        value: stats.teachersTotal == null || Number.isNaN(stats.teachersTotal) ? '—' : String(stats.teachersTotal),
        change: '',
        trend: 'up',
        color: COLORS.icon,
        Icon: Users,
      },
      {
        title: 'Asistencias hoy',
        value: stats.attendanceToday == null || Number.isNaN(stats.attendanceToday) ? '—' : String(stats.attendanceToday),
        change: '',
        trend: 'up',
        color: COLORS.icon,
        Icon: Activity,
      },
      {
        title: 'Reportes',
        value: stats.reportsTotal == null || Number.isNaN(stats.reportsTotal) ? '—' : String(stats.reportsTotal),
        change: '',
        trend: 'up',
        color: COLORS.icon,
        Icon: TrendingUp,
      },
    ],
    [stats, COLORS]
  );

  const drawerItems = useMemo(
    () => [
      { label: 'Perfil', Icon: User, onPress: () => navigation.navigate('AdminProfile') },
      { label: 'Estudiantes', Icon: GraduationCap, onPress: () => navigation.navigate('AdminStudents') },
      { label: 'Docentes', Icon: Users, onPress: () => navigation.navigate('AdminTeachers') },
      { label: 'Carga masiva', Icon: Upload, onPress: () => navigation.navigate('AdminBulkUpload') },
      { label: 'QR institucional', Icon: QrCode, onPress: () => navigation.navigate('AdminQrInstitutional') },
      { label: 'Logs', Icon: Activity, onPress: () => navigation.navigate('AdminLogs') },
      { label: 'Auditoría', Icon: ClipboardList, onPress: () => navigation.navigate('AdminAudit') },
      { label: 'Consentimientos', Icon: ShieldCheck, onPress: () => navigation.navigate('AdminConsents') },
    ],
    [navigation]
  );

  const TrendIcon = (trend) => (trend === 'up' ? ArrowUpRight : ArrowDownRight);

  return (
    <View style={styles.root}>
      <SideDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpen={() => setDrawerOpen(true)}
        photoUri={photoUri}
        fallbackSource={require('../../../assets/escudo_umb.png')}
        roleLabel="Administrador"
        name={personDisplayName(fullName, 'Administrador')}
        items={drawerItems}
        onLogout={() => {
          logout();
          navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.userRow}>
              <Pressable onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>
                <Menu size={22} color={COLORS.white} />
              </Pressable>
              <Text style={styles.headerTitle}>Tablero</Text>
            </View>
            <Pressable
              onPress={() => {
                logout();
                navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
              }}
              style={styles.logoutBtn}
            >
              <LogOut size={18} color={COLORS.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <View style={{ height: 12 }} />
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
                        <TIcon size={14} color={c.trend === 'up' ? COLORS.successStrong : COLORS.dangerStrong} />
                        <Text style={[styles.trendText, { color: c.trend === 'up' ? COLORS.successStrong : COLORS.dangerStrong }]}>{c.change}</Text>
                      </View>
                    </View>
                    <View style={[styles.statIconWrap, { backgroundColor: COLORS.surface }]}>
                      <c.Icon size={18} color={c.color} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ height: 18 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 18 },
  header: { backgroundColor: COLORS.primary, paddingTop: 54, paddingHorizontal: 24, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 12 },
  menuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontSize: 20, fontWeight: '900' },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 26 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', backgroundColor: COLORS.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statTitle: { fontSize: 12, color: COLORS.muted },
  statValue: { marginTop: 6, fontSize: 18, fontWeight: '900', color: COLORS.text },
  trendRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendText: { fontWeight: '800' },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontWeight: '900', color: COLORS.textSecondary },
});
