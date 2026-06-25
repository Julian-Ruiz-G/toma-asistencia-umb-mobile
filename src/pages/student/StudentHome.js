// Importaciones necesarias para el componente de inicio del estudiante
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
// Importación de íconos desde lucide-react-native
import {
  Bell,
  Calendar,
  LogOut,
  QrCode,
  RefreshCw,
  ScanLine,
  User,
} from 'lucide-react-native';

// Importaciones de configuración y contexto
import { COLORS } from '../../ui/theme';
import { useAuth } from '../../state/auth';
import { MY_CLASSES_URL, STUDENT_DAILY_SUMMARY_URL, STUDENT_NOTIFICATIONS_URL } from '../../config';

// Componente principal de la pantalla de inicio del estudiante
export default function StudentHome({ navigation }) {
  // Obtener datos de autenticación desde el contexto
  const { logout, email, authToken } = useAuth();
  // Estados locales del componente
  const [classes, setClasses] = useState([]); // Lista de clases registradas
  const [loadingClasses, setLoadingClasses] = useState(false); // Estado de carga
  const [dailySummary, setDailySummary] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);

  // Función para normalizar nombres de días a formato estándar en inglés
  const parseDayKey = (raw) => {
    const s = String(raw || '').trim().toLowerCase();
    // Mapeo completo de días en múltiples formatos (inglés, español, abreviaturas)
    const map = {
      monday: 'MONDAY', mon: 'MONDAY', lunes: 'MONDAY', lun: 'MONDAY',
      tuesday: 'TUESDAY', tue: 'TUESDAY', martes: 'TUESDAY', mar: 'TUESDAY',
      wednesday: 'WEDNESDAY', wed: 'WEDNESDAY', miercoles: 'WEDNESDAY', 'miércoles': 'WEDNESDAY', mie: 'WEDNESDAY', 'mié': 'WEDNESDAY',
      thursday: 'THURSDAY', thu: 'THURSDAY', jueves: 'THURSDAY', jue: 'THURSDAY',
      friday: 'FRIDAY', fri: 'FRIDAY', viernes: 'FRIDAY', vie: 'FRIDAY',
      saturday: 'SATURDAY', sat: 'SATURDAY', sabado: 'SATURDAY', 'sábado': 'SATURDAY', sab: 'SATURDAY',
      sunday: 'SUNDAY', sun: 'SUNDAY', domingo: 'SUNDAY', dom: 'SUNDAY',
    };
    return map[s] || String(raw || '').trim().toUpperCase();
  };

  // Función para obtener la clave del día actual en formato estándar
  const getTodayKey = () => {
    const d = new Date().getDay(); // getDay(): 0=Domingo, 1=Lunes, ..., 6=Sábado
    return d === 0 ? 'SUNDAY' : d === 1 ? 'MONDAY' : d === 2 ? 'TUESDAY' : d === 3 ? 'WEDNESDAY' : d === 4 ? 'THURSDAY' : d === 5 ? 'FRIDAY' : 'SATURDAY';
  };

  // Función para convertir hora en formato HH:MM a minutos totales
  const parseTimeToMinutes = (raw) => {
    const str = String(raw || '').trim();
    // Extraer horas y minutos usando regex
    const m = str.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm; // Convertir a minutos totales
  };

  // Función para determinar si una clase está en progreso ahora mismo
  const isClassInProgressNow = (c) => {
    // Obtener horario desde múltiples campos posibles
    const raw = c?.schedule || c?.schedules || c?.horario || c?.horarios;
    if (!Array.isArray(raw) || !raw.length) return false;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes(); // Minutos totales actuales
    const todayKey = getTodayKey();
    return raw.some((s) => {
      // Verificar si alguna entrada del horario corresponde al día actual
      const dayKey = parseDayKey(s?.day || s?.dia);
      if (dayKey !== todayKey) return false;
      // Extraer horas de inicio y fin
      const start = s?.startTime || s?.start || s?.horaInicio;
      const end = s?.endTime || s?.end || s?.horaFin;
      const startMin = parseTimeToMinutes(start);
      const endMin = parseTimeToMinutes(end);
      if (startMin == null || endMin == null) return false;
      // Verificar si la hora actual está dentro del rango de la clase
      return nowMin >= startMin && nowMin <= endMin;
    });
  };

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
    } catch (e) {
      // Mostrar alerta en caso de error
      Alert.alert('Error', e?.message || String(e));
    } finally {
      // Finalizar estado de carga
      setLoadingClasses(false);
    }
  };

  // Efecto para cargar clases al montar el componente
  useEffect(() => {
    loadClasses();
    // cargar resumen diario y notificaciones
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
            setNotificationCount(arr.length);
          }
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      id: 'notifications',
      title: 'Notificaciones',
      description: 'Mensajes y alertas importantes',
      Icon: Bell,
      bg: '#F59E0B',
      onPress: () => navigation.navigate('StudentNotifications'),
      badge: notificationCount, // Muestra contador de notificaciones
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
  ]), [navigation, notificationCount]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Image source={require('../../../assets/escudo_umb.png')} style={styles.avatarImg} />
              </View>
              <View>
                <Text style={styles.welcome}>Bienvenido,</Text>
                <Text style={styles.userName}>{email || 'Estudiante'}</Text>
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

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{String(dailySummary?.summary?.asistencia ?? '—')}</Text>
              <Text style={styles.statLabel}>Asistencia</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{classes.length}</Text>
              <Text style={styles.statLabel}>Clases registradas</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{String(dailySummary?.summary?.retardo ?? '—')}</Text>
              <Text style={styles.statLabel}>Retardos</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Menú Principal</Text>
            <View style={styles.grid}>
              {menuItems.map((item) => (
                <Pressable key={item.id} onPress={item.onPress} style={styles.gridItem}>
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
              ))}
            </View>
          </View>

          <View style={[styles.card, { marginTop: 18 }]}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Mis clases</Text>
              <Pressable onPress={loadClasses} style={styles.recentLink}>
                <RefreshCw size={16} color={COLORS.primary} />
                <Text style={styles.recentLinkText}>{loadingClasses ? 'Cargando…' : 'Actualizar'}</Text>
              </Pressable>
            </View>

            <View style={{ height: 10 }} />

            {classes.map((c, idx) => {
              const title = c?.className || c?.subject || c?.name || 'Clase';
              const group = c?.group || c?.groupName || c?.grupo || '';
              const inProgress = isClassInProgressNow(c);
              return (
                <View key={String(c?.classId || c?.id || idx)} style={styles.activityRow}>
                  <View style={[styles.activityIcon, { backgroundColor: COLORS.primary }]}>
                    <QrCode size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{title}</Text>
                    <Text style={styles.activitySub}>{group ? `Grupo ${group}` : ''}</Text>
                  </View>
                  <View style={[styles.statusPill, inProgress ? styles.statusPillActive : styles.statusPillPending]}>
                    <Text style={[styles.statusPillText, inProgress ? styles.statusTextActive : styles.statusTextPending]}>
                      {inProgress ? 'En proceso' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
              );
            })}

            {!loadingClasses && classes.length === 0 ? (
              <Text style={styles.emptyText}>Aún no estás inscrito en clases.</Text>
            ) : null}
          </View>
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
  welcome: { color: 'rgba(255,255,255,0.70)', fontSize: 14 },
  userName: { color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 2 },
  logoutBtn: {
    padding: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.70)', fontSize: 12, marginTop: 2 },
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
  gridItem: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
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
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentLink: { flexDirection: 'row', alignItems: 'center' },
  recentLinkText: { color: COLORS.primary, fontWeight: '700', marginRight: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14 },
  activityIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityTitle: { fontWeight: '800', color: '#1F2937', fontSize: 13 },
  activitySub: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#6B7280', textAlign: 'center', marginTop: 6 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  statusPillActive: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  statusPillPending: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  statusPillText: { fontSize: 12, fontWeight: '900' },
  statusTextActive: { color: '#16A34A' },
  statusTextPending: { color: '#A16207' },
});
