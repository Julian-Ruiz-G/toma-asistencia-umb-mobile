// Importaciones necesarias para el componente
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
// Importación de íconos desde lucide-react-native
import {
  ArrowLeft,
  CheckCircle,
  Clock3,
  MoreVertical,
  RefreshCw,
  Search,
  Trash,
  UserX,
  Users,
} from 'lucide-react-native';

// Importaciones de configuración y contexto
import { COLORS } from '../../ui/theme';
import { ATTENDANCE_DETAILS_URL, REMOVE_STUDENT_FROM_CLASS_URL } from '../../config';
import { useAuth } from '../../state/auth';

// Componente principal del dashboard de asistencia en vivo
export default function LiveAttendanceDashboard({ navigation, route }) {
  // Obtener token de autenticación desde el contexto
  const { authToken } = useAuth();
  // Obtener sesión de asistencia y metadatos de la clase desde los parámetros de navegación
  const attendanceSession = route?.params?.attendanceSession;
  const classMeta = route?.params?.classMeta;
  // Normalizar el sessionId desde múltiples posibles fuentes en el payload
  const sessionIdParam =
    route?.params?.sessionId ||
    attendanceSession?.sessionId ||
    attendanceSession?.session?.sessionId ||
    attendanceSession?.attendanceSession?.sessionId ||
    attendanceSession?.attendance_session?.sessionId ||
    attendanceSession?.attendance?.sessionId ||
    '';
  // Estados locales del componente
  const [remoteDetails, setRemoteDetails] = useState(null); // Detalles de asistencia desde backend
  const [loadingRemote, setLoadingRemote] = useState(false); // Estado de carga
  const [sessionId, setSessionId] = useState(String(sessionIdParam || '')); // ID de sesión

  // Estados para filtrado y búsqueda
  const [filter, setFilter] = useState('all'); // Filtro de estado (all/present/late/absent)
  const [searchQuery, setSearchQuery] = useState(''); // Query de búsqueda de estudiantes
  const [lastUpdated, setLastUpdated] = useState(new Date()); // Última actualización
  const [showActions, setShowActions] = useState(null); // Menú de acciones por estudiante

  // Función para eliminar un estudiante de la clase
  const removeStudent = async (studentId, studentName) => {
    if (!REMOVE_STUDENT_FROM_CLASS_URL || !authToken) {
      Alert.alert('Error', 'Configuración no disponible');
      return;
    }

    Alert.alert(
      'Eliminar Estudiante',
      `¿Estás seguro que quieres eliminar a "${studentName}" de la clase?\n\nEsta acción eliminará:\n• La inscripción del estudiante\n• Todos sus registros de asistencia\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Extraer email del studentId (que contiene el email)
              const studentEmail = studentId.includes('@') ? studentId : '';
              
              if (!studentEmail) {
                Alert.alert('Error', 'No se puede identificar el email del estudiante');
                return;
              }

              const response = await fetch(REMOVE_STUDENT_FROM_CLASS_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ 
                  classId: attendanceSession?.classId || '',
                  studentEmail: studentEmail 
                }),
              });

              const text = await response.text();
              let json;
              try {
                json = JSON.parse(text);
              } catch {
                json = null;
              }

              if (!response.ok) {
                const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${response.status}`;
                throw new Error(msg);
              }

              Alert.alert(
                'Estudiante Eliminado',
                json?.message || `${studentName} fue eliminado exitosamente`,
                [{ text: 'OK', onPress: () => loadRemote() }]
              );
            } catch (err) {
              Alert.alert('Error', err?.message || String(err));
            }
          }
        }
      ]
    );
  };

  // Función asíncrona para cargar detalles de asistencia desde el backend
  const loadRemote = async () => {
    // Validaciones previas
    if (!ATTENDANCE_DETAILS_URL) return;
    if (!authToken) return;
    if (!sessionId) return;

    setLoadingRemote(true);
    try {
      // Realizar petición POST al endpoint de detalles de asistencia
      const resp = await fetch(ATTENDANCE_DETAILS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      const text = await resp.text();
      let json;
      try {
        // Intentar parsear la respuesta como JSON
        json = JSON.parse(text);
        // 🔍 DEBUG: Log de respuesta del backend
        console.log('DEBUG Backend Response:', JSON.stringify(json, null, 2));
      } catch {
        json = null;
      }
      if (!resp.ok) {
        // Manejar errores de respuesta
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      // Actualizar estado con los datos recibidos
      setRemoteDetails(json);
    } catch (e) {
      // Mostrar alerta en caso de error
      Alert.alert('Error', e?.message || String(e));
    } finally {
      // Finalizar estado de carga
      setLoadingRemote(false);
    }
  };

  // Efecto para cargar datos iniciales cuando cambia el sessionId
  useEffect(() => {
    if (!sessionId) return;
    loadRemote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Efecto para configurar el polling (actualización automática cada 5 segundos)
  useEffect(() => {
    if (!sessionId) return;
    const id = setInterval(() => {
      loadRemote();
    }, 5000); // Intervalo de 5 segundos para actualización en tiempo real
    return () => clearInterval(id); // Limpieza del intervalo al desmontar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Memoización para normalizar los datos de estudiantes desde el backend
  const normalizedRemoteStudents = useMemo(() => {
    // Extraer resultados del response o usar array vacío
    const results = Array.isArray(remoteDetails?.results) ? remoteDetails.results : [];
    // 🔍 DEBUG: Log de resultados crudos
    console.log('DEBUG Raw Results:', results);
    return results.map((r, idx) => {
      // Normalizar el estado del estudiante
      const statusRaw = String(r?.status || '').toLowerCase();
      const status = statusRaw === 'asistencia' ? 'asistencia' : statusRaw === 'retardo' ? 'retardo' : 'inasistencia';
      // 🔍 DEBUG: Log de cada estudiante
      console.log(`DEBUG Student ${idx}:`, { statusRaw, status, student: r?.studentEmail });
      return {
        id: String(r?.studentEmail || r?.studentCode || idx), // ID único del estudiante
        code: r?.studentCode || '', // Código del estudiante
        name: r?.studentName || r?.studentEmail || 'Sin nombre', // Nombre para mostrar
        status, // Estado normalizado
        time: r?.time || r?.markedAt || '', // Hora de marcación
        method: r?.method || 'manual', // Método de marcación (qr/face/manual)
      };
    });
  }, [remoteDetails]);

  // Alias para la fuente de datos normalizada
  const dataSource = normalizedRemoteStudents;

  // Calcular estadísticas de asistencia usando memoización
  const stats = useMemo(() => {
    const total = dataSource.length;
    const present = dataSource.filter((s) => s.status === 'asistencia').length;
    const late = dataSource.filter((s) => s.status === 'retardo').length;
    const absent = dataSource.filter((s) => s.status === 'inasistencia').length;
    return { total, present, late, absent };
  }, [dataSource]);

  // Memoización para filtrar estudiantes según filtro y búsqueda
  const filteredStudents = useMemo(() => {
    return dataSource.filter((student) => {
      // Verificar si coincide con el filtro de estado
      const matchesFilter = filter === 'all' || student.status === filter;
      // Normalizar query de búsqueda
      const q = searchQuery.trim().toLowerCase();
      // Verificar coincidencia en nombre o código
      const matchesSearch =
        !q ||
        student.name.toLowerCase().includes(q) ||
        String(student.code || '').includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [dataSource, filter, searchQuery]);

  // Función para obtener configuración visual según estado del estudiante
  const getStatusConfig = (status) => {
    switch (status) {
      case 'asistencia':
        return { Icon: CheckCircle, label: 'Presente', bg: '#ECFDF5', border: '#BBF7D0', text: '#16A34A' };
      case 'retardo':
        return { Icon: Clock3, label: 'Retardo', bg: '#FFFBEB', border: '#FDE68A', text: '#A16207' };
      case 'inasistencia':
        return { Icon: UserX, label: 'Ausente', bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C' };
    }
  };

  // Función para obtener el indicador visual del método de marcación
  const getMethodDot = (method) => {
    // Asignar color según método: qr=azul, face=púrpura, manual=gris
    const color = method === 'qr' ? '#3B82F6' : method === 'face' ? '#A855F7' : '#9CA3AF';
    return <View style={[styles.methodDot, { backgroundColor: color }]} />;
  };

  // Función para actualizar estado (placeholder para futura implementación)
  const updateStatus = () => {
    setShowActions(null);
  };

  // Calcular porcentaje de asistencia (presentes + retardos) / total
  const pct = stats.total ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Asistencia en Vivo</Text>
          <Text style={styles.headerSubtitle}>
            {(classMeta?.title || 'Clase')}
            {classMeta?.group ? ` • ${classMeta.group}` : ''}
            {sessionId ? ` • ${sessionId}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setLastUpdated(new Date());
            loadRemote();
          }}
          style={styles.iconBtn}
        >
          <RefreshCw size={20} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {!sessionId ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Consulta por sesión</Text>
            <Text style={styles.infoText}>Pega el sessionId de una asistencia anterior para ver el listado.</Text>
            <View style={{ height: 10 }} />
            <TextInput
              value={sessionId}
              onChangeText={setSessionId}
              placeholder="sessionId"
              placeholderTextColor="#9CA3AF"
              style={styles.sessionInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ height: 10 }} />
            <Pressable onPress={loadRemote} style={styles.consultBtn}>
              <Text style={styles.consultBtnText}>Consultar</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.total}</Text>
            <Text style={styles.statLbl}>Total</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAccentGreen]}>
            <Text style={[styles.statNum, { color: '#16A34A' }]}>{stats.present}</Text>
            <Text style={styles.statLbl}>Presentes</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAccentYellow]}>
            <Text style={[styles.statNum, { color: '#A16207' }]}>{stats.late}</Text>
            <Text style={styles.statLbl}>Retardos</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAccentRed]}>
            <Text style={[styles.statNum, { color: '#B91C1C' }]}>{stats.absent}</Text>
            <Text style={styles.statLbl}>Ausentes</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Progreso de asistencia</Text>
            <Text style={styles.progressPct}>{pct}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
          </View>
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.searchWrap}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar estudiante..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {[
            { v: 'all', t: 'Todos' },
            { v: 'present', t: 'Presentes' },
            { v: 'late', t: 'Retardos' },
            { v: 'absent', t: 'Ausentes' },
          ].map((x) => {
            const active = filter === x.v;
            return (
              <Pressable
                key={x.v}
                onPress={() => setFilter(x.v)}
                style={[styles.filterPill, active ? styles.filterPillActive : null]}
              >
                <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{x.t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ height: 12 }} />

        {filteredStudents.map((student) => {
          const cfg = getStatusConfig(student.status);
          return (
            <View key={student.id} style={[styles.studentCard, { borderColor: cfg.border }]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {student.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameRow}>
                  <Text numberOfLines={1} style={styles.studentName}>{student.name}</Text>
                  {getMethodDot(student.method)}
                </View>
                <Text style={styles.studentCode}>{student.code}</Text>
              </View>

              <View style={styles.rightCol}>
                <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
                {student.time ? <Text style={styles.timeText}>{student.time}</Text> : null}

                <View style={{ position: 'relative' }}>
                  <Pressable
                    onPress={() => setShowActions(showActions === student.id ? null : student.id)}
                    style={styles.moreBtn}
                  >
                    <MoreVertical size={16} color="#9CA3AF" />
                  </Pressable>

                  {showActions === student.id ? (
                    <View style={styles.actionsMenu}>
                      <Pressable onPress={() => updateStatus(student.id, 'asistencia')} style={styles.actionItem}>
                        <Text style={[styles.actionText, { color: '#16A34A' }]}>Marcar presente</Text>
                      </Pressable>
                      <Pressable onPress={() => updateStatus(student.id, 'retardo')} style={styles.actionItem}>
                        <Text style={[styles.actionText, { color: '#A16207' }]}>Marcar retardo</Text>
                      </Pressable>
                      <Pressable onPress={() => updateStatus(student.id, 'inasistencia')} style={styles.actionItem}>
                        <Text style={[styles.actionText, { color: '#B91C1C' }]}>Marcar ausente</Text>
                      </Pressable>
                      <View style={styles.actionSeparator} />
                      <Pressable onPress={() => removeStudent(student.id, student.name)} style={styles.actionItem}>
                        <Trash size={16} color="#DC2626" style={{ marginRight: 8 }} />
                        <Text style={[styles.actionText, { color: '#DC2626' }]}>Eliminar estudiante</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}

        {filteredStudents.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Users size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No se encontraron estudiantes</Text>
          </View>
        ) : null}

        <View style={{ height: 10 }} />
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>Actualizado: {lastUpdated.toLocaleTimeString()}</Text>
          <Pressable onPress={() => navigation.navigate('TeacherManualCorrection')}>
            <Text style={styles.footerLink}>Corrección manual</Text>
          </Pressable>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 12, borderRadius: 999 },
  iconBtn: { padding: 10, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: '#6B7280' },
  body: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },
  infoBox: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  infoTitle: { fontWeight: '900', color: '#111827' },
  infoText: { marginTop: 6, color: '#6B7280', fontSize: 12, lineHeight: 16 },
  sessionInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#111827' },
  consultBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  consultBtnText: { color: '#fff', fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  statCardAccentGreen: { borderBottomWidth: 2, borderBottomColor: '#22C55E' },
  statCardAccentYellow: { borderBottomWidth: 2, borderBottomColor: '#EAB308' },
  statCardAccentRed: { borderBottomWidth: 2, borderBottomColor: '#EF4444' },
  statNum: { fontSize: 18, fontWeight: '900', color: '#1F2937' },
  statLbl: { marginTop: 2, fontSize: 11, color: '#6B7280' },
  progressCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { color: '#6B7280' },
  progressPct: { fontWeight: '900', color: COLORS.primary },
  progressBarBg: { marginTop: 10, height: 8, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 999 },
  searchWrap: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, color: '#111827' },
  filterRow: { gap: 10, paddingTop: 10, paddingBottom: 2 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { color: '#6B7280', fontWeight: '800' },
  filterTextActive: { color: '#fff' },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '900', color: '#4B5563' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  studentName: { fontWeight: '900', color: '#111827', flex: 1 },
  methodDot: { width: 8, height: 8, borderRadius: 4 },
  studentCode: { marginTop: 2, fontSize: 12, color: '#6B7280' },
  rightCol: { alignItems: 'flex-end' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontWeight: '900', fontSize: 12 },
  timeText: { marginTop: 6, fontSize: 11, color: '#9CA3AF' },
  moreBtn: { marginTop: 6, padding: 6, borderRadius: 10 },
  actionsMenu: {
    position: 'absolute',
    right: 0,
    top: 35,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    width: 180,
    overflow: 'hidden',
    zIndex: 9999,
  },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  actionText: { fontWeight: '800', fontSize: 14 },
  actionSeparator: { height: 1, backgroundColor: '#E5E7EB', marginHorizontal: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { marginTop: 10, color: '#6B7280' },
  footerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerText: { fontSize: 12, color: '#6B7280' },
  footerLink: { color: COLORS.primary, fontWeight: '900' },
});
