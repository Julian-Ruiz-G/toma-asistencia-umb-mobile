import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Activity,
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
import { useAuth } from '../../state/auth';
import { personDisplayName } from '../../utils/displayName';
import { loadLocalProfile } from '../../utils/sessionStore';
import { fetchAdminDashboard } from '../../utils/adminDashboard';

export default function AdminDashboard({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken, logout, fullName, email, photoUri, setPhotoUri } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const local = await loadLocalProfile(email);
      if (local?.photoUri) setPhotoUri(String(local.photoUri));
    })();
  }, [email, setPhotoUri]);

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
        hint: 'Solo estadísticas',
        Icon: GraduationCap,
      },
      {
        key: 'teachers',
        title: 'Docentes',
        value: fmt(data?.teachers?.total),
        hint: data?.teachers?.classesTotal != null ? `${data.teachers.classesTotal} clases` : 'Solo estadísticas',
        Icon: Users,
      },
      {
        key: 'attendance',
        title: 'Asistencia',
        value: fmt(data?.attendance?.markedToday),
        hint: data ? `${data.attendance.presentToday} presentes hoy` : 'Toca para analizar',
        Icon: Activity,
      },
      {
        key: 'reports',
        title: 'Sesiones',
        value: fmt(data?.reportsTotal),
        hint: 'Reconocimiento facial',
        Icon: TrendingUp,
      },
    ],
    [data]
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
            >
              <LogOut size={18} color={COLORS.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Indicadores</Text>
          <Text style={styles.sectionHint}>Toca una tarjeta para ver las gráficas. Estudiantes y docentes del menú son para gestionar perfiles.</Text>
          <View style={styles.grid2}>
            {statsCards.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => navigation.navigate('AdminInsight', { section: c.key })}
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
      </ScrollView>
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
