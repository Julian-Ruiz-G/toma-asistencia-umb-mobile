// Importaciones necesarias para el componente de historial de sesiones
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
      Alert.alert('Error', 'No se proporcionó ID de clase');
      return;
    }
    if (!authToken) {
      console.log('❌ DEBUG: No authToken proporcionado');
      Alert.alert('Error', 'Sesión inválida');
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
        const todayStr = new Date().toISOString().split('T')[0];
        const mapped = fromApi.map((s) => ({
          sessionId: s.sessionId,
          sessionDate: s.sessionDate,
          scheduledStartEpoch: parseInt(String(s.scheduledStartEpoch || '0'), 10) || 0,
          lateAfterSeconds: parseInt(String(s.lateAfterSeconds || '900'), 10) || 900,
          status: s.sessionDate === todayStr ? 'active' : 'completed',
          totalStudents: 0,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          createdAt: s.sessionDate ? `${s.sessionDate}T12:00:00Z` : new Date().toISOString(),
          classInfo: {
            className: classDetails?.class?.className || className || 'Clase sin nombre',
            group: classDetails?.class?.group || group || 'A',
            room: classDetails?.class?.room || room || 'Aula 101',
            subject: classDetails?.class?.className || className || 'Materia',
            teacher: classDetails?.class?.teacherEmail || email || 'Docente',
          },
          schedule: {
            startTime: classDetails?.class?.startTime || '09:00',
            endTime: classDetails?.class?.endTime || '10:30',
            day: '',
          },
        }));
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
          sessions.push({
            sessionId: attendanceSession.sessionId,
            sessionDate: attendanceSession.sessionDate || new Date().toISOString().split('T')[0],
            scheduledStartEpoch: parseInt(attendanceSession.scheduledStartEpoch) || Math.floor(new Date().setHours(9, 0, 0, 0) / 1000),
            lateAfterSeconds: parseInt(attendanceSession.lateAfterSeconds) || 900,
            status: 'active',
            totalStudents: classDetails?.students?.length || 0,
            presentCount: 0, // Se actualizará al cargar detalles
            lateCount: 0,
            absentCount: 0,
            createdAt: attendanceSession.createdAt || new Date().toISOString(),
            classInfo: {
              className: classDetails?.class?.className || className || 'Clase sin nombre',
              group: classDetails?.class?.group || group || 'A',
              room: classDetails?.class?.room || room || 'Aula 101',
              subject: classDetails?.class?.className || className || 'Materia',
              teacher: classDetails?.class?.teacherEmail || email || 'Docente',
            },
            schedule: {
              startTime: classDetails?.class?.startTime || '09:00',
              endTime: classDetails?.class?.endTime || '10:30',
              day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }).split(',')[0],
            },
          });
        } else {
          console.log('❌ DEBUG: attendanceSession.classId no coincide con classId');
        }
      } else {
        console.log('❌ DEBUG: No se encontró attendanceSession');
      }
      
      // 2. Buscar sesiones reales de esta clase específica usando el formato del backend
      console.log('🔍 DEBUG: Buscando sesiones reales para classId:', classId);
      
      // El backend ahora usa formato: classId_fecha para sessionIds
      const today = new Date();
      const realSessions = [];
      
      // Buscar sesiones de los últimos días usando el formato real del backend
      for (let i = 0; i <= 7; i++) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        // Formato real que usa el backend: classId_fecha
        const sessionId = `${classId}_${dateStr}`;
        console.log(`🔍 DEBUG: Probando sessionId: ${sessionId}`);
        
        // Crear sesión temporal para probar si existe
        const tempSession = {
          sessionId: sessionId,
          sessionDate: dateStr,
          scheduledStartEpoch: Math.floor(date.setHours(9, 0, 0, 0) / 1000),
          lateAfterSeconds: 900,
          status: dateStr === today.toISOString().split('T')[0] ? 'active' : 'completed',
          totalStudents: 0,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          createdAt: dateStr + 'T09:00:00Z',
          classInfo: {
            className: classDetails?.class?.className || className || 'Clase sin nombre',
            group: classDetails?.class?.group || group || 'A',
            room: classDetails?.class?.room || room || 'Aula 101',
            subject: classDetails?.class?.className || className || 'Materia',
            teacher: classDetails?.class?.teacherEmail || email || 'Docente',
          },
          schedule: {
            startTime: classDetails?.class?.startTime || '09:00',
            endTime: classDetails?.class?.endTime || '10:30',
            day: date.toLocaleDateString('es-ES', { weekday: 'long' }).split(',')[0],
          },
        };
        
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
        new Date(b.sessionDate) - new Date(a.sessionDate)
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
      Alert.alert('Error', e?.message || String(e));
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
      Alert.alert('QR de Sesión Activa', 'Esta sesión ya está activa. Usa el botón "Ver QR" desde la página principal.');
    } else {
      // Para sesiones completadas, mostrar mensaje
      Alert.alert('QR de Sesión', `Esta sesión ya finalizó. No se puede generar QR para sesiones anteriores.`);
    }
  };

  // Función para descargar reporte de sesión específica
  const handleDownloadReport = (session) => {
    const sid = session?.sessionId || session?.id || '';
    if (!sid) {
      Alert.alert('Reporte', 'Esta sesión no tiene identificador válido.');
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
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Función para formatear hora
  const formatTime = (epoch) => {
    const date = new Date(epoch * 1000);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
          sessions.map((session) => (
            <Card key={session.sessionId} style={styles.sessionCard}>
              {/* Header con información de clase y sesión */}
              <View style={styles.sessionHeader}>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionDate}>
                    {formatDate(session.sessionDate)}
                  </Text>
                  <Text style={styles.sessionTime}>
                    <Clock size={16} color="#6B7280" />
                    {' '}{session.schedule?.startTime || formatTime(session.scheduledStartEpoch)} - {session.schedule?.endTime || '10:30'}
                  </Text>
                  <Text style={styles.sessionClass}>
                    {session.classInfo?.className || className} • {session.classInfo?.group || group} • {session.classInfo?.room || room}
                  </Text>
                </View>
                <View style={styles.sessionStatus}>
                  <View style={[
                    styles.statusPill,
                    { backgroundColor: session.status === 'completed' ? '#10B981' : session.status === 'active' ? '#F59E0B' : '#6B7280' }
                  ]}>
                    <Text style={styles.statusText}>
                      {session.status === 'completed' ? 'Completada' : session.status === 'active' ? 'Activa' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Detalles de la clase */}
              <View style={styles.classDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Materia:</Text>
                  <Text style={styles.detailValue}>{session.classInfo?.subject || className}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Docente:</Text>
                  <Text style={styles.detailValue}>{session.classInfo?.teacher || email}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Día:</Text>
                  <Text style={styles.detailValue}>{session.schedule?.day || 'Sin especificar'}</Text>
                </View>
              </View>

              {/* Estadísticas de asistencia */}
              <View style={styles.sessionStats}>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Users size={16} color="#6B7280" />
                    <Text style={styles.statText}>{session.totalStudents} estudiantes</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Asistencia:</Text>
                    <Text style={[
                      styles.statValue,
                      { color: calculateAttendancePercentage(session.presentCount, session.lateCount, session.totalStudents) >= 80 ? '#10B981' : '#F59E0B' }
                    ]}>
                      {calculateAttendancePercentage(session.presentCount, session.lateCount, session.totalStudents)}%
                    </Text>
                  </View>
                </View>
                
                <View style={styles.attendanceBreakdown}>
                  <View style={styles.breakdownItem}>
                    <View style={styles.breakdownDot} />
                    <Text style={styles.breakdownText}>
                      Presentes: {session.presentCount}
                    </Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.breakdownText}>
                      Retardos: {session.lateCount}
                    </Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.breakdownText}>
                      Ausentes: {session.absentCount}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Información de tiempo */}
              <View style={styles.timeInfo}>
                <Text style={styles.timeLabel}>
                  Sesión creada: {new Date(session.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.timeLabel}>
                  Tolerancia: {Math.floor((session.lateAfterSeconds || 600) / 60)} minutos
                </Text>
              </View>

              {/* Acciones */}
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
          ))
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
    gap: 12,
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
    padding: 16,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 14,
    color: '#6B7280',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionClass: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  sessionStatus: {
    marginLeft: 12,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  classDetails: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  sessionStats: {
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#6B7280',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  attendanceBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  breakdownText: {
    fontSize: 12,
    color: '#6B7280',
  },
  sessionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    gap: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
