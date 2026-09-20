// Importaciones necesarias para el componente de historial de sesiones
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
// Importación de íconos desde lucide-react-native
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  QrCode,
  RefreshCw,
  Users,
  Eye,
  Trash2,
} from 'lucide-react-native';

// Importaciones de componentes y configuración
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { COLORS } from '../../ui/theme';
import { useAuth } from '../../state/auth';
import { ATTENDANCE_DETAILS_URL, CLASS_DETAILS_URL } from '../../config';
import {
  colombiaDateLongFromYmd,
  colombiaTodayYmd,
  colombiaWeekdayLongFromYmd,
  formatActionDateTime,
  formatClockTime,
} from '../../utils/formatDateTime';
import { DAY_LONG, formatScheduleFriendly, resolveSessionYmd, scheduleHoursForYmd } from '../../utils/schedule';
import { personDisplayName } from '../../utils/displayName';

function mapClassSession(s, classDetails, extras = {}) {
  const klass = classDetails?.class || {};
  const sessionDate = resolveSessionYmd({
    sessionDate: s?.sessionDate,
    sessionId: s?.sessionId,
    scheduledStartEpoch: s?.scheduledStartEpoch,
    schedule: klass.schedule,
  });
  const hours = scheduleHoursForYmd(klass.schedule, sessionDate);
  const startTime = hours.startTime || '';
  const endTime = hours.endTime || '';
  return {
    sessionId: s?.sessionId,
    sessionDate,
    scheduledStartEpoch: parseInt(String(s?.scheduledStartEpoch || '0'), 10) || 0,
    lateAfterSeconds: parseInt(String(s?.lateAfterSeconds || '900'), 10) || 900,
    status: sessionDate && sessionDate === colombiaTodayYmd() ? 'active' : 'completed',
    totalStudents: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    createdAt: s?.createdAt || '',
    classInfo: {
      className: klass.className || extras.className || '',
      group: klass.group || extras.group || '',
      room: klass.room || extras.room || '',
      subject: klass.className || extras.className || '',
      teacher: personDisplayName(klass.teacherName, klass.teacherEmail || extras.email || ''),
      scheduleLabel: formatScheduleFriendly(klass),
    },
    schedule: {
      startTime,
      endTime,
      day: DAY_LONG[hours.dayKey] || colombiaWeekdayLongFromYmd(sessionDate),
    },
  };
}

// Componente principal del historial de sesiones
export default function SessionHistory({ navigation, route }) {
  // Obtener datos de autenticación y parámetros de navegación
  const { authToken, email } = useAuth();
  const { classId, className, group, room } = route.params || {};
  
  // Estados locales del componente
  const [sessions, setSessions] = useState([]); // Lista de sesiones
  const [loadingSessions, setLoadingSessions] = useState(false); // Estado de carga
  const [refreshing, setRefreshing] = useState(false); // Estado de refresco

  // Función para obtener detalles de clase
  const getClassDetails = async () => {
    if (!CLASS_DETAILS_URL || !classId || !authToken) return null;
    
    try {
      const resp = await fetch(CLASS_DETAILS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ classId }),
      });

      if (!resp.ok) return null;
      
      const text = await resp.text();
      const json = JSON.parse(text);
      return json;
    } catch (e) {
      console.log('Error obteniendo detalles de clase:', e);
      return null;
    }
  };

  // Función para cargar estadísticas de una sesión específica
  const loadSessionStats = async (session) => {
    if (!ATTENDANCE_DETAILS_URL || !session.sessionId || !authToken) return session;
    
    try {
      const resp = await fetch(ATTENDANCE_DETAILS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      if (!resp.ok) return session;
      
      const text = await resp.text();
      const json = JSON.parse(text);
      
      if (json.ok && json.results) {
        const results = json.results;
        const presentCount = results.filter(r => r.status === 'asistencia').length;
        const lateCount = results.filter(r => r.status === 'retardo').length;
        const absentCount = results.filter(r => r.status === 'inasistencia').length;
        
        return {
          ...session,
          totalStudents: results.length,
          presentCount,
          lateCount,
          absentCount,
        };
      }
    } catch (e) {
      console.log('Error cargando estadísticas de sesión:', e);
    }
    
    return session;
  };

  // Función asíncrona para cargar historial de sesiones desde el backend
  const loadSessions = async () => {
    console.log('🔍 DEBUG: Iniciando loadSessions');
    console.log('🔍 DEBUG: classId:', classId);
    console.log('🔍 DEBUG: authToken:', authToken ? 'exists' : 'missing');
    
    // Validaciones previas
    if (!classId) {
      console.log('❌ DEBUG: No classId proporcionado');
      appAlert('Error', 'No se proporcionó ID de clase');
      return;
    }
    if (!authToken) {
      console.log('❌ DEBUG: No authToken proporcionado');
      appAlert('Error', 'Sesión inválida');
      return;
    }

    setLoadingSessions(true);
    try {
      console.log('🔍 DEBUG: Obteniendo detalles de clase...');
      // Obtener detalles de la clase para información básica
      const classDetails = await getClassDetails();
      console.log('🔍 DEBUG: classDetails obtenidos:', classDetails ? JSON.stringify(Object.keys(classDetails)) : 'null');

      // Lista completa desde API (misma que Informe): más recientes primero
      const fromApi = Array.isArray(classDetails?.attendanceSessions) ? classDetails.attendanceSessions : [];
      if (fromApi.length > 0) {
        const extras = { className, group, room, email };
        const mapped = fromApi.map((s) => mapClassSession(s, classDetails, extras));
        mapped.sort((a, b) => {
          const da = String(a.sessionDate || '');
          const db = String(b.sessionDate || '');
          if (db !== da) return db.localeCompare(da);
          return (b.scheduledStartEpoch || 0) - (a.scheduledStartEpoch || 0);
        });
        const withStats = await Promise.all(mapped.map((session) => loadSessionStats(session)));
        setSessions(withStats);
        setLoadingSessions(false);
        setRefreshing(false);
        return;
      }
      
      // Buscar sesiones reales de esta clase específica
      const sessions = [];
      
      // 1. Buscar sesión activa en CLASS_DETAILS_URL
      const attendanceSession = classDetails?.attendanceSession || classDetails?.attendance_session || classDetails?.attendance;
      console.log('🔍 DEBUG: attendanceSession encontrado:', attendanceSession ? 'YES' : 'NO');
      console.log('🔍 DEBUG: attendanceSession.classId:', attendanceSession?.classId);
      console.log('🔍 DEBUG: expected classId:', classId);
      
      if (attendanceSession?.sessionId) {
        console.log('🔍 DEBUG: sessionId encontrado:', attendanceSession.sessionId);
        // Verificar que la sesión pertenezca a esta clase
        if (attendanceSession.classId === classId) {
          console.log('✅ DEBUG: Sesión activa encontrada para esta clase');
          // Sesión activa encontrada para esta clase
          sessions.push(mapClassSession({
            ...attendanceSession,
            sessionDate: attendanceSession.sessionDate,
          }, classDetails, { className, group, room, email }));
        } else {
          console.log('❌ DEBUG: attendanceSession.classId no coincide con classId');
        }
      } else {
        console.log('❌ DEBUG: No se encontró attendanceSession');
      }
      
      // 2. Buscar sesiones reales de esta clase específica usando el formato del backend
      console.log('🔍 DEBUG: Buscando sesiones reales para classId:', classId);
      
      // El backend ahora usa formato: classId_fecha para sessionIds
      const extras = { className, group, room, email };
      const todayYmd = colombiaTodayYmd();
      const realSessions = [];

      for (let i = 0; i <= 7; i++) {
        const probeYmd = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(Date.parse(`${todayYmd}T12:00:00-05:00`) - i * 86400000));
        const sessionId = `${classId}_${probeYmd}`;
        console.log(`🔍 DEBUG: Probando sessionId: ${sessionId}`);

        const tempSession = mapClassSession({
          sessionId,
          sessionDate: probeYmd,
          scheduledStartEpoch: 0,
          lateAfterSeconds: 900,
        }, classDetails, extras);
        
        // Intentar cargar estadísticas reales
        const sessionWithStats = await loadSessionStats(tempSession);
        console.log(`🔍 DEBUG: Session ${sessionId} stats:`, sessionWithStats.totalStudents);
        
        // Si la sesión tiene datos reales (totalStudents > 0), significa que existe
        if (sessionWithStats.totalStudents > 0) {
          console.log(`✅ DEBUG: Sesión real encontrada: ${sessionId}`);
          // Evitar duplicados con la sesión activa
          const alreadyExists = sessions.some(s => s.sessionId === sessionWithStats.sessionId);
          if (!alreadyExists) {
            realSessions.push(sessionWithStats);
          }
        } else {
          console.log(`❌ DEBUG: No hay datos para sesión: ${sessionId}`);
        }
      }
      
      // Agregar sesiones reales encontradas
      sessions.push(...realSessions);
      console.log(`🔍 DEBUG: Sesiones reales encontradas: ${realSessions.length}`);
      
      // Ordenar sesiones por fecha (más reciente primero)
      const sortedSessions = sessions.sort((a, b) =>
        String(b.sessionDate || '').localeCompare(String(a.sessionDate || ''))
      );
      
      // Cargar estadísticas reales para cada sesión (si no se cargaron antes)
      const sessionsWithStats = await Promise.all(
        sortedSessions.map(session => {
          // Si ya tiene estadísticas reales, mantenerlas
          if (session.totalStudents > 0 && (session.presentCount > 0 || session.lateCount > 0 || session.absentCount > 0)) {
            return session;
          }
          // Si no, cargar estadísticas
          return loadSessionStats(session);
        })
      );
      
      // No agregar datos mock - solo mostrar sesiones reales de esta clase
      if (sessionsWithStats.length === 0) {
        console.log('ℹ️ DEBUG: No hay sesiones reales para esta clase:', classId);
      }
      
      setSessions(sessionsWithStats);
      console.log(`📊 Historial final: ${sessionsWithStats.length} sesiones para clase ${classId}`);
      console.log('📊 DEBUG: Sessions finales:', sessionsWithStats.map(s => ({ id: s.sessionId, date: s.sessionDate, status: s.status })));
    } catch (e) {
      console.log('❌ Error cargando historial:', e);
      appAlert('Error', e?.message || String(e));
    } finally {
      setLoadingSessions(false);
      setRefreshing(false);
    }
  };

  // Efecto para cargar sesiones al montar el componente
  useEffect(() => {
    loadSessions();
  }, [classId]);

  // Función para manejar refresco manual
  const handleRefresh = () => {
    setRefreshing(true);
    loadSessions();
  };

  // Función para navegar a dashboard de asistencia específico
  const handleViewSession = (session) => {
    navigation.navigate('TeacherLiveAttendanceDashboard', {
      sessionId: session.sessionId,
      classId,
      classMeta: { title: className || session.classInfo?.className, group: group || session.classInfo?.group, room: room || session.classInfo?.room },
      attendanceSession: session,
    });
  };

  // Función para generar QR para sesión específica
  const handleGenerateQR = (session) => {
    if (session.status === 'active') {
      // Para sesión activa, navegar a pantalla de QR
      appAlert('QR de Sesión Activa', 'Esta sesión ya está activa. Usa el botón "Ver QR" desde la página principal.');
    } else {
      // Para sesiones completadas, mostrar mensaje
      appAlert('QR de Sesión', `Esta sesión ya finalizó. No se puede generar QR para sesiones anteriores.`);
    }
  };

  // Función para descargar reporte de sesión específica
  const handleDownloadReport = (session) => {
    const sid = session?.sessionId || session?.id || '';
    if (!sid) {
      appAlert('Reporte', 'Esta sesión no tiene identificador válido.');
      return;
    }
    navigation.navigate('ReportActions', {
      sessionId: sid,
      classId,
      classMeta: {
        title: className || session?.classInfo?.className || 'Clase',
        group: group || session?.classInfo?.group || '',
        room: room || session?.classInfo?.room || '',
      },
    });
  };

  // Función para formatear fecha
  const formatDate = (dateString) => colombiaDateLongFromYmd(dateString) || String(dateString || '—');

  const formatTime = (epoch) => formatClockTime(epoch, '');

  // Calcular porcentaje de asistencia
  const calculateAttendancePercentage = (present, late, total) => {
    if (!total) return 0;
    return Math.round(((present + late) / total) * 100);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.headerTitle}>Historial de Sesiones</Text>
          {className && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {className} {group ? `• ${group}` : ''}
            </Text>
          )}
        </View>
        <Pressable onPress={handleRefresh} style={styles.iconBtn}>
          <RefreshCw size={20} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {sessions.length === 0 && !loadingSessions ? (
          <View style={styles.emptyState}>
            <Calendar size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No hay sesiones registradas</Text>
            <Text style={styles.emptySubtitle}>
              Las sesiones de asistencia aparecerán aquí
            </Text>
          </View>
        ) : (
          sessions.map((session) => {
            const weekday = session.schedule?.day || colombiaWeekdayLongFromYmd(session.sessionDate) || '—';
            const start = session.schedule?.startTime || formatTime(session.scheduledStartEpoch);
            const end = session.schedule?.endTime || '';
            const hoursLabel = start && end ? `${start} – ${end}` : start || end || '';
            const pct = calculateAttendancePercentage(session.presentCount, session.lateCount, session.totalStudents);
            const roomLabel = session.classInfo?.room || room || '';
            return (
            <Card key={session.sessionId} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View style={styles.sessionInfo}>
                  <Text style={styles.weekday}>{weekday}</Text>
                  <Text style={styles.sessionDate}>
                    {formatDate(session.sessionDate)}
                  </Text>
                </View>
                <View style={[
                  styles.statusPill,
                  { backgroundColor: session.status === 'completed' ? '#10B981' : session.status === 'active' ? '#F59E0B' : '#6B7280' }
                ]}>
                  <Text style={styles.statusText}>
                    {session.status === 'completed' ? 'Completada' : session.status === 'active' ? 'Activa' : 'Pendiente'}
                  </Text>
                </View>
              </View>

              <View style={styles.metaChips}>
                {hoursLabel ? (
                  <View style={styles.chip}>
                    <Clock size={14} color="#6B7280" />
                    <Text style={styles.chipText}>{hoursLabel}</Text>
                  </View>
                ) : null}
                {roomLabel ? (
                  <View style={styles.chip}>
                    <Calendar size={14} color="#6B7280" />
                    <Text style={styles.chipText}>{roomLabel}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.sessionClass}>
                {session.classInfo?.className || className}
                {session.classInfo?.group || group ? `  ·  Grupo ${session.classInfo?.group || group}` : ''}
              </Text>
              {session.classInfo?.scheduleLabel ? (
                <Text style={styles.sessionClass}>Horario de la materia: {session.classInfo.scheduleLabel}</Text>
              ) : null}

              <View style={styles.classDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Materia</Text>
                  <Text style={styles.detailValue}>{session.classInfo?.subject || className}</Text>
                </View>
                {(session.classInfo?.group || group) ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Grupo</Text>
                    <Text style={styles.detailValue}>{session.classInfo?.group || group}</Text>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Docente</Text>
                  <Text style={styles.detailValue}>{session.classInfo?.teacher || email}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Día de la sesión</Text>
                  <Text style={styles.detailValue}>{weekday}</Text>
                </View>
                <View style={[styles.detailRow, { marginBottom: 0 }]}>
                  <Text style={styles.detailLabel}>ID de sesión</Text>
                  <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                    {session.sessionId}
                  </Text>
                </View>
              </View>

              <View style={styles.sessionStats}>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Users size={16} color="#6B7280" />
                    <Text style={styles.statText}>{session.totalStudents} estudiantes</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Asistencia</Text>
                    <Text style={[styles.statValue, { color: pct >= 80 ? '#10B981' : '#F59E0B' }]}>
                      {pct}%
                    </Text>
                  </View>
                </View>

                <View style={styles.attendanceBreakdown}>
                  <View style={styles.breakdownCol}>
                    <Text style={[styles.breakdownNum, { color: '#10B981' }]}>{session.presentCount}</Text>
                    <Text style={styles.breakdownText}>Presentes</Text>
                  </View>
                  <View style={styles.breakdownCol}>
                    <Text style={[styles.breakdownNum, { color: '#F59E0B' }]}>{session.lateCount}</Text>
                    <Text style={styles.breakdownText}>Retardos</Text>
                  </View>
                  <View style={styles.breakdownCol}>
                    <Text style={[styles.breakdownNum, { color: '#EF4444' }]}>{session.absentCount}</Text>
                    <Text style={styles.breakdownText}>Ausentes</Text>
                  </View>
                </View>
              </View>

              <View style={styles.timeInfo}>
                <Text style={styles.timeLabel}>
                  Creada {session.createdAt ? formatActionDateTime(session.createdAt) : '—'}
                </Text>
                <Text style={styles.timeLabel}>
                  Tolerancia {Math.floor((session.lateAfterSeconds || 600) / 60)} min
                </Text>
              </View>

              <View style={styles.sessionActions}>
                <Pressable
                  onPress={() => handleViewSession(session)}
                  style={[styles.actionBtn, { backgroundColor: '#EBF8FF' }]}
                >
                  <Eye size={16} color="#0284C7" />
                  <Text style={[styles.actionText, { color: '#0284C7' }]}>Ver</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleGenerateQR(session)}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: session.status === 'active' ? '#F0FDF4' : '#F3F4F6' }
                  ]}
                  disabled={session.status !== 'active'}
                >
                  <QrCode size={16} color={session.status === 'active' ? '#16A34A' : '#9CA3AF'} />
                  <Text style={[
                    styles.actionText,
                    { color: session.status === 'active' ? '#16A34A' : '#9CA3AF' }
                  ]}>
                    QR
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDownloadReport(session)}
                  style={[styles.actionBtn, { backgroundColor: '#FFFBEB' }]}
                >
                  <Download size={16} color="#D97706" />
                  <Text style={[styles.actionText, { color: '#D97706' }]}>Reporte</Text>
                </Pressable>
              </View>
            </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// Estilos del componente
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50, // Aumentar para espacio de status bar
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 22, // Aumentar tamaño
    fontWeight: '700',
    color: '#111827',
    flex: 1, // Permitir que ocupe espacio disponible
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginLeft: 12, // Espacio a la izquierda
  },
  body: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  sessionCard: {
    padding: 18,
    borderRadius: 18,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  weekday: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    textTransform: 'capitalize',
    lineHeight: 24,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  sessionClass: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600',
    marginBottom: 14,
    lineHeight: 20,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  classDetails: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    width: 90,
  },
  detailValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    flex: 1,
  },
  sessionStats: {
    marginBottom: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  attendanceBreakdown: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  breakdownCol: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownNum: {
    fontSize: 18,
    fontWeight: '900',
  },
  breakdownText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 4,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
