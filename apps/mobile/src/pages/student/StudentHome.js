// Importaciones necesarias para el componente de inicio del estudiante
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import { useFocusEffect } from '@react-navigation/native';
// Importación de íconos desde lucide-react-native
import {
  Bell,
  BellRing,
  BookOpen,
  Calendar,
  ChevronRight,
  History,
  LogOut,
  ScanLine,
  User,
} from 'lucide-react-native';

// Importaciones de configuración y contexto
import { COLORS } from '../../ui/theme';
import Animated, { enterDown, listEnter } from '../../ui/motion';
import { useAuth } from '../../state/auth';
import { MY_CLASSES_URL, STUDENT_ATTENDANCE_HISTORY_URL, STUDENT_DAILY_SUMMARY_URL, STUDENT_NOTIFICATIONS_URL } from '../../config';
import { personDisplayName } from '../../utils/displayName';
import { loadLocalProfile } from '../../utils/sessionStore';
import { isStudentProfileComplete, studentProfileIncompleteMessage } from '../../utils/studentProfile';
import { syncClassSoonNotifications } from '../../utils/classSoon';
import { classStatusMeta } from '../../utils/schedule';

// Componente principal de la pantalla de inicio del estudiante
export default function StudentHome({ navigation }) {
  // Obtener datos de autenticación desde el contexto
  const { logout, authToken, fullName, email, program, semester, phone, setProgram, setSemester, setPhone, photoUri, setPhotoUri, notificationUnread, setNotificationUnread, classesRevision } = useAuth();
  // Estados locales del componente
  const [classes, setClasses] = useState([]); // Lista de clases registradas
  const [loadingClasses, setLoadingClasses] = useState(false); // Estado de carga
  const [dailySummary, setDailySummary] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, late: 0, absent: 0, loaded: false });
  const profileRef = React.useRef({ fullName, program, semester, phone });
  profileRef.current = { fullName, program, semester, phone };

  // Función asíncrona para cargar las clases registradas del estudiante
  const loadClasses = async () => {
    // Validaciones previas
    if (!MY_CLASSES_URL) return;
    if (!authToken) return;
    setLoadingClasses(true);
    try {
      // Realizar petición POST al backend para obtener clases
      const resp = await fetch(MY_CLASSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({}), // Cuerpo vacío para obtener todas las clases
      });
      const text = await resp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (!resp.ok) {
        // Manejar errores de respuesta
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      // Extraer array de clases desde múltiples posibles campos del response
      const arr =
        (Array.isArray(json?.classes) && json.classes) ||
        (Array.isArray(json?.myClasses) && json.myClasses) ||
        (Array.isArray(json) && json) ||
        [];
      setClasses(arr);
      syncClassSoonNotifications(email, arr).catch(() => {});
    } catch (e) {
      // Mostrar alerta en caso de error
      appAlert('Error', e?.message || String(e));
    } finally {
      // Finalizar estado de carga
      setLoadingClasses(false);
    }
  };

  // Efecto para cargar clases al montar el componente
  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, classesRevision]);

  useEffect(() => {
    (async () => {
      try {
        if (!authToken) return;

        if (STUDENT_DAILY_SUMMARY_URL) {
          const resp = await fetch(STUDENT_DAILY_SUMMARY_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({}),
          });
          const text = await resp.text();
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          if (resp.ok) {
            setDailySummary(json);
          }
        }

        if (STUDENT_ATTENDANCE_HISTORY_URL) {
          const resp = await fetch(STUDENT_ATTENDANCE_HISTORY_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({}),
          });
          const text = await resp.text();
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          if (resp.ok) {
            const summary = json?.summary || {};
            const records = Array.isArray(json?.records) ? json.records : [];
            const present = Number(summary.present);
            const late = Number(summary.late);
            const absent = Number(summary.absent);
            setAttendanceStats({
              present: Number.isFinite(present)
                ? present
                : records.filter((r) => r?.status === 'present').length,
              late: Number.isFinite(late)
                ? late
                : records.filter((r) => r?.status === 'late').length,
              absent: Number.isFinite(absent)
                ? absent
                : records.filter((r) => r?.status === 'absent' || r?.status === 'inasistencia').length,
              loaded: true,
            });
          }
        }

        if (STUDENT_NOTIFICATIONS_URL) {
          const resp = await fetch(STUDENT_NOTIFICATIONS_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({}),
          });
          const text = await resp.text();
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          if (resp.ok) {
            const arr = Array.isArray(json?.notifications) ? json.notifications : [];
            const unread = Number.isFinite(Number(json?.unreadCount))
              ? Number(json.unreadCount)
              : arr.filter((n) => !n?.read).length;
            setNotificationUnread(unread);
          }
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !STUDENT_NOTIFICATIONS_URL) return undefined;
    let cancelled = false;
    const loadNotifs = async () => {
      try {
        const resp = await fetch(STUDENT_NOTIFICATIONS_URL, {
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
        if (!cancelled && resp.ok) {
          const arr = Array.isArray(json?.notifications) ? json.notifications : [];
          const unread = Number.isFinite(Number(json?.unreadCount))
            ? Number(json.unreadCount)
            : arr.filter((n) => !n?.read).length;
          setNotificationUnread(unread);
        }
      } catch {
        // ignore
      }
    };
    loadNotifs();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadClasses();
      (async () => {
        const local = await loadLocalProfile(email);
        if (cancelled) return;
        const nextPhoto = String(local?.photoUri || '');
        if (nextPhoto) setPhotoUri(nextPhoto);
        const cur = profileRef.current;
        const nextProgram = cur.program || String(local?.program || '');
        const nextSemester = cur.semester || String(local?.semester || '');
        const nextPhone = cur.phone || String(local?.phone || '');
        if (!cur.program && nextProgram) setProgram(nextProgram);
        if (!cur.semester && nextSemester) setSemester(nextSemester);
        if (!cur.phone && nextPhone) setPhone(nextPhone);

        const profile = {
          fullName: cur.fullName,
          program: nextProgram,
          semester: nextSemester,
          phone: nextPhone,
        };
        if (isStudentProfileComplete(profile)) return;
        appAlert(
          'Completa tu perfil',
          studentProfileIncompleteMessage(profile),
          [
            {
              text: 'Completar ahora',
              onPress: () => navigation.navigate('StudentProfile', { forceEdit: true }),
            },
          ],
          { cancelable: false }
        );
      })();
      return () => {
        cancelled = true;
      };
    }, [email, navigation, setProgram, setSemester, setPhone, setPhotoUri])
  );

  // Memoización para definir los elementos del menú principal
  const menuItems = useMemo(() => ([
    {
      id: 'scan',
      title: 'Escanear QR',
      description: 'Registra tu asistencia escaneando el código',
      Icon: ScanLine,
      bg: COLORS.primary,
      onPress: () => navigation.navigate('StudentQr'),
      badge: null,
    },
    {
      id: 'schedule',
      title: 'Horario',
      description: 'Revisa tu horario de clases',
      Icon: Calendar,
      bg: COLORS.blue,
      onPress: () => navigation.navigate('StudentSchedule'),
      badge: null,
    },
    {
      id: 'reminders',
      title: 'Recordatorio',
      description: 'Actividades y pendientes',
      Icon: BellRing,
      bg: '#7C3AED',
      onPress: () => navigation.navigate('StudentReminders'),
      badge: null,
    },
    {
      id: 'history',
      title: 'Historial',
      description: 'Tu registro de asistencias',
      Icon: History,
      bg: '#0F766E',
      onPress: () => navigation.navigate('StudentAttendanceHistory'),
      badge: null,
    },
    {
      id: 'notifications',
      title: 'Notificaciones',
      description: 'Mensajes y alertas importantes',
      Icon: Bell,
      bg: '#F59E0B',
      onPress: () => navigation.navigate('StudentNotifications'),
      badge: notificationUnread + (isStudentProfileComplete({ fullName, program, semester, phone }) ? 0 : 1),
    },
    {
      id: 'profile',
      title: 'Perfil',
      description: 'Tu información y configuración',
      Icon: User,
      bg: '#10B981',
      onPress: () => navigation.navigate('StudentProfile'),
      badge: null,
    },
  ]), [navigation, notificationUnread, fullName, program, semester, phone]);

  const asistenciaCount = attendanceStats.loaded
    ? attendanceStats.present
    : Number(dailySummary?.totals?.asistencia ?? dailySummary?.summary?.asistencia ?? 0);
  const retardoCount = attendanceStats.loaded
    ? attendanceStats.late
    : Number(dailySummary?.totals?.retardo ?? dailySummary?.summary?.retardo ?? 0);
  const fallasCount = attendanceStats.loaded
    ? attendanceStats.absent
    : Number(dailySummary?.totals?.inasistencia ?? dailySummary?.summary?.inasistencia ?? 0);
  const classesCount = Number(dailySummary?.classesCount ?? classes.length ?? 0);

  const openHistory = (filter) => {
    navigation.navigate('StudentAttendanceHistory', { filter });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={enterDown(0, 400)} style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.userRow}>
              <Pressable onPress={() => navigation.navigate('StudentProfile')} style={styles.avatar}>
                <Image
                  key={photoUri || 'default'}
                  source={photoUri ? { uri: photoUri } : require('../../../assets/escudo_umb.png')}
                  style={photoUri ? styles.avatarPhoto : styles.avatarImg}
                />
              </Pressable>
              <View>
                <Text style={styles.welcome}>Bienvenido,</Text>
                <Text style={styles.userName}>{personDisplayName(fullName, 'Estudiante')}</Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                logout();
                navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
              }}
              style={styles.logoutBtn}
            >
              <LogOut size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.statsBlock}>
            <View style={styles.statsRow}>
              <Pressable onPress={() => openHistory('present')} style={styles.statCard}>
                <Text style={styles.statValue}>{String(asistenciaCount)}</Text>
                <Text style={styles.statLabel}>Asistencia</Text>
              </Pressable>
              <Pressable onPress={() => openHistory('all')} style={styles.statCard}>
                <Text style={styles.statValue}>{String(classesCount)}</Text>
                <Text style={styles.statLabel}>Clases registradas</Text>
              </Pressable>
            </View>
            <View style={styles.statsRow}>
              <Pressable onPress={() => openHistory('late')} style={styles.statCard}>
                <Text style={styles.statValue}>{String(retardoCount)}</Text>
                <Text style={styles.statLabel}>Retardos</Text>
              </Pressable>
              <Pressable onPress={() => openHistory('absent')} style={styles.statCard}>
                <Text style={styles.statValue}>{String(fallasCount)}</Text>
                <Text style={styles.statLabel}>Fallas</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        <View style={styles.content}>
          <Animated.View entering={enterDown(120)} style={styles.card}>
            <Text style={styles.sectionTitle}>Menú Principal</Text>
            <View style={styles.grid}>
              {menuItems.map((item, idx) => (
                <Animated.View key={item.id} entering={listEnter(idx)} style={styles.gridItemWrap}>
                <Pressable onPress={item.onPress} style={styles.gridItem}>
                  <View style={[styles.gridIconWrap, { backgroundColor: item.bg }]}>
                    <item.Icon size={24} color="#fff" />
                  </View>
                  <Text style={styles.gridTitle}>{item.title}</Text>
                  <Text style={styles.gridDesc} numberOfLines={2}>{item.description}</Text>
                  {item.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={enterDown(200)} style={[styles.card, { marginTop: 18 }]}>
            <Text style={styles.sectionTitle}>Mis clases</Text>

            <View style={{ height: 10 }} />

            {classes.map((c, idx) => {
              const title = c?.className || c?.subject || c?.name || 'Clase';
              const group = c?.group || c?.groupName || c?.grupo || '';
              const classId = c?.classId || c?.id;
              const status = classStatusMeta(c);
              return (
                <Animated.View
                  key={String(classId || idx)}
                  entering={listEnter(idx)}
                >
                  <Pressable
                    onPress={() => navigation.navigate('StudentClassDetails', { classId, classPreview: c })}
                    style={styles.activityRow}
                  >
                    <View style={[styles.activityIcon, { backgroundColor: COLORS.primary }]}>
                      <BookOpen size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle}>{title}</Text>
                      <Text style={styles.activitySub}>{group ? `Grupo ${group}` : 'Toca para ver detalles'}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: status.pillBg, borderColor: status.pillBorder }]}>
                      <Text style={[styles.statusPillText, { color: status.pillText }]}>{status.label}</Text>
                    </View>
                    <ChevronRight size={18} color="#9CA3AF" />
                  </Pressable>
                </Animated.View>
              );
            })}

            {!loadingClasses && classes.length === 0 ? (
              <Text style={styles.emptyText}>Aún no estás inscrito en clases.</Text>
            ) : null}
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 24 },
  header: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: COLORS.primary,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, resizeMode: 'contain' },
  avatarPhoto: { width: 48, height: 48, resizeMode: 'cover' },
  welcome: { color: 'rgba(255,255,255,0.70)', fontSize: 14 },
  userName: { color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 2 },
  logoutBtn: {
    padding: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statsBlock: { marginTop: 18, gap: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.70)', fontSize: 12, marginTop: 2, textAlign: 'center' },
  content: { paddingHorizontal: 24, paddingTop: 18, marginTop: -16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  sectionTitle: { color: '#1F2937', fontWeight: '800', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItemWrap: { width: '48%', marginBottom: 12 },
  gridItem: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 14,
    padding: 14,
  },
  gridIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gridTitle: { fontWeight: '800', color: '#1F2937', fontSize: 14 },
  gridDesc: { color: '#6B7280', fontSize: 12, marginTop: 4, lineHeight: 16 },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  activityRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14 },
  activityIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityTitle: { fontWeight: '800', color: '#1F2937', fontSize: 13 },
  activitySub: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#6B7280', textAlign: 'center', marginTop: 6 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: '900' },
});
