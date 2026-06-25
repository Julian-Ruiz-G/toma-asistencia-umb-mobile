import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardList,
  Camera,
  CheckCircle,
  Clock,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  LogOut,
  QrCode,
  Settings,
  Trash,
  Users,
} from 'lucide-react-native';

import { COLORS } from '../ui/theme';
import { useAuth } from '../state/auth';
import { CLASS_DETAILS_URL, CREATE_ATTENDANCE_QR_URL, MY_CLASSES_URL, DELETE_CLASS_URL } from '../config';

export default function TeacherHome({ navigation }) {
  const { logout, authToken, email } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const createAttendanceSession = async (classId) => {
    if (!CREATE_ATTENDANCE_QR_URL) {
      Alert.alert('API no configurada', 'Falta CREATE_ATTENDANCE_QR_URL');
      return null;
    }
    if (!authToken) {
      Alert.alert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return null;
    }
    if (!classId) {
      Alert.alert('Error', 'classId inválido');
      return null;
    }

    try {
      const resp = await fetch(CREATE_ATTENDANCE_QR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ classId }),
      });
      const text = await resp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (!resp.ok) {
        if (json?.error === 'NotScheduledToday') {
          return { __notScheduledToday: true, today: json?.today || '' };
        }
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      return json;
    } catch (err) {
      const errorData = err?.message ? JSON.parse(err.message) : { error: String(err) };
      
      if (errorData.error === 'TooEarlyForQR') {
        Alert.alert('Muy Temprano', errorData.message || 'El QR solo puede generarse 30 minutos antes de la clase.');
        return null;
      } else if (errorData.error === 'TooLateForQR') {
        Alert.alert('Muy Tarde', errorData.message || 'El QR solo puede generarse hasta 2 horas después del inicio de clase.');
        return null;
      } else if (errorData.error === 'NotScheduledToday') {
        Alert.alert('Sin Clase Hoy', `No tienes clase programada para hoy (${errorData.today || 'hoy'}).`);
        return null;
      } else {
        Alert.alert('Error', errorData.error || errorData.message || String(err));
        return null;
      }
    }
  };

  // Función para obtener sesión activa existente (para usar misma que QR)
  const getActiveAttendanceSession = async (classId) => {
    if (!authToken) return null;

    // 🔍 Estrategia 1: Buscar en CLASS_DETAILS_URL
    if (CLASS_DETAILS_URL) {
      try {
        const resp = await fetch(CLASS_DETAILS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ classId }),
        });

        if (resp.ok) {
          const text = await resp.text();
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }

          // 🔍 Buscar sesión en múltiples campos posibles
          const attendanceSession = json?.attendanceSession || json?.attendance_session || json?.attendance;
          if (attendanceSession?.sessionId) {
            // 📅 Verificar si la sesión es del día de hoy
            const today = new Date().toISOString().split('T')[0];
            const sessionDate = attendanceSession?.sessionDate || attendanceSession?.date || attendanceSession?.createdAt?.split('T')[0];
            
            if (sessionDate === today) {
              console.log('✅ Sesión del día encontrada en CLASS_DETAILS_URL:', attendanceSession.sessionId);
              return attendanceSession;
            }
          }
        }
      } catch (err) {
        console.log('❌ Error en CLASS_DETAILS_URL:', err);
      }
    }

    // 🔍 Estrategia 2: Buscar en MY_CLASSES_URL (fallback)
    if (MY_CLASSES_URL) {
      try {
        const resp = await fetch(MY_CLASSES_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({}),
        });

        if (resp.ok) {
          const text = await resp.text();
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }

          // Buscar la clase específica en MY_CLASSES_URL
          const allClasses = json?.classes || json?.myClasses || json || [];
          const targetClass = allClasses.find(c => 
            c?.classId === classId || c?.id === classId || String(c?.classId || c?.id) === String(classId)
          );

          if (targetClass) {
            const attendanceSession = targetClass?.attendanceSession || targetClass?.attendance_session || targetClass?.attendance;
            if (attendanceSession?.sessionId) {
              const today = new Date().toISOString().split('T')[0];
              const sessionDate = attendanceSession?.sessionDate || attendanceSession?.date || attendanceSession?.createdAt?.split('T')[0];
              
              if (sessionDate === today) {
                console.log('✅ Sesión del día encontrada en MY_CLASSES_URL:', attendanceSession.sessionId);
                return attendanceSession;
              }
            }
          }
        }
      } catch (err) {
        console.log('❌ Error en MY_CLASSES_URL:', err);
      }
    }

    console.log('❌ No se encontró sesión del día en ningún endpoint');
    return null;
  };

  // Función para crear o reutilizar sesión del día actual
  const createOrReuseTodaySession = async (classId) => {
    console.log('🔍 Buscando sesión existente para classId:', classId);
    
    // 🔍 Primero buscar sesión existente del día de hoy
    const existingSession = await getActiveAttendanceSession(classId);
    if (existingSession) {
      console.log('✅ Reutilizando sesión existente:', existingSession.sessionId);
      return existingSession; // ✅ Reutilizar sesión de hoy
    }

    console.log('❌ No se encontró sesión del día, creando nueva...');
    // ❌ Si no hay sesión de hoy, crear una nueva
    const newSession = await createAttendanceSession(classId);
    console.log('🆕 Nueva sesión creada:', newSession?.sessionId);
    return newSession;
  };

  const loadClasses = async () => {
    if (!MY_CLASSES_URL) {
      Alert.alert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }
    if (!authToken) {
      Alert.alert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return;
    }

    setLoadingClasses(true);
    try {
      const resp = await fetch(MY_CLASSES_URL, {
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

      if (!resp.ok) {
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      setClasses(json?.classes || json?.myClasses || json || []);
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setLoadingClasses(false);
    }
  };
  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsub = navigation?.addListener?.('focus', () => {
      loadClasses();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#22C55E';
      case 'pending':
        return '#EAB308';
      case 'completed':
        return '#9CA3AF';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'En progreso';
      case 'pending':
        return 'Pendiente';
      case 'completed':
        return 'Finalizada';
      default:
        return 'Desconocido';
    }
  };

  const parseTimeToMinutes = (t) => {
    const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  };

  const isClassInProgressNow = (c) => {
    const raw = c?.schedule || c?.schedules || c?.horario || c?.horarios;
    if (!Array.isArray(raw)) return false;
    const todayKey = getTodayKey();
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    return raw.some((s) => {
      const dayKey = parseDayKey(s?.day || s?.dia);
      if (dayKey !== todayKey) return false;
      const start = s?.startTime || s?.start || s?.horaInicio;
      const end = s?.endTime || s?.end || s?.horaFin;
      const startMin = parseTimeToMinutes(start);
      const endMin = parseTimeToMinutes(end);
      if (startMin == null || endMin == null) return false;
      return nowMin >= startMin && nowMin <= endMin;
    });
  };

  const parseDayKey = (value) => {
    const v = String(value || '').toUpperCase().trim();
    if (!v) return '';
    if (v.startsWith('MON')) return 'LUNES';
    if (v.startsWith('TUE')) return 'MARTES';
    if (v.startsWith('WED')) return 'MIERCOLES';
    if (v.startsWith('THU')) return 'JUEVES';
    if (v.startsWith('FRI')) return 'VIERNES';
    if (v.startsWith('SAT')) return 'SABADO';
    if (v.startsWith('SUN')) return 'DOMINGO  ';
    // Spanish
    if (v.startsWith('LUN')) return 'LUNES';
    if (v.startsWith('MAR')) return 'MARTES';
    if (v.startsWith('MIE') || v.startsWith('MIÉ')) return 'MIERCOLES';
    if (v.startsWith('JUE')) return 'JUEVES';
    if (v.startsWith('VIE')) return 'VIERNES';
    if (v.startsWith('SAB') || v.startsWith('SÁB')) return 'SABADO';
    if (v.startsWith('DOM')) return 'DOMINGO';
    return v;
  };

  // Obtiene la clave del día actual en formato inglés para comparar con horarios
// getDay(): 0=Domingo, 1=Lunes, ..., 6=Sábado
const getTodayKey = () => {
    const d = new Date().getDay();
    // JS: 0=Sun,1=Mon...
    if (d === 0) return 'DOMINGO';
    if (d === 1) return 'LUNES';
    if (d === 2) return 'MARTES';
    if (d === 3) return 'MIERCOLES';
    if (d === 4) return 'JUEVES';
    if (d === 5) return 'VIERNES';
    return 'SABADO';
  };

  // Formatea el horario de una clase para mostrarlo de manera legible
// Convierte los días a abreviaturas en español y formatea las horas
const formatSchedule = (c) => {
    if (!c) return '';
    if (typeof c.schedule === 'string') return c.schedule;
    // Intenta obtener el horario desde diferentes posibles campos del backend
    const raw = c.schedule || c.schedules || c.horario || c.horarios;
    if (!raw) return '';
    const arr = Array.isArray(raw) ? raw : [];
    const items = arr
      .map((s) => {
        // Extrae día y horas desde diferentes posibles nombres de campos
        const day = s?.day || s?.dia;
        const start = s?.startTime || s?.start || s?.horaInicio;
        const end = s?.endTime || s?.end || s?.horaFin;
        // Convierte el día a clave estándar en inglés
        const dayKey = parseDayKey(day);
        // Mapea la clave del día a su abreviatura en español
        const label = dayKey
          ? {
              MONDAY: 'Lun',
              TUESDAY: 'Mar',
              WEDNESDAY: 'Mié',
              THURSDAY: 'Jue',
              FRIDAY: 'Vie',
              SATURDAY: 'Sáb',
              SUNDAY: 'Dom',
            }[dayKey] || dayKey
          : '';
        // Formatea el rango de horas
        const t = start && end ? `${start}-${end}` : start || end || '';
        return `${label} ${t}`.trim();
      })
      .filter(Boolean);
    // Une múltiples horarios con separador
    return items.join(' • ');
  };

  const stats = useMemo(() => {
    const totalClasses = classes.length;
    const todayKey = getTodayKey();
    let classesToday = 0;
    let totalStudents = 0;
    let activeClasses = 0;

    classes.forEach((c) => {
      const status = c?.status || c?.classStatus || 'active';
      if (status === 'active') activeClasses += 1;

      const sc =
        Number(c?.studentsCount) ||
        Number(c?.studentCount) ||
        (Array.isArray(c?.students) ? c.students.length : 0) ||
        0;
      totalStudents += sc;

      const raw = c?.schedule || c?.schedules || c?.horario || c?.horarios;
      if (typeof raw === 'string') {
        // Heuristic: try to match short day names inside the string
        const s = raw.toLowerCase();
        const keyToNeedle = {
          MONDAY: ['lun'],
          TUESDAY: ['mar'],
          WEDNESDAY: ['mie', 'mié'],
          THURSDAY: ['jue'],
          FRIDAY: ['vie'],
          SATURDAY: ['sab', 'sáb'],
          SUNDAY: ['dom'],
        };
        if ((keyToNeedle[todayKey] || []).some((n) => s.includes(n))) classesToday += 1;
      } else if (Array.isArray(raw)) {
        const hasToday = raw.some((x) => parseDayKey(x?.day || x?.dia) === todayKey);
        if (hasToday) classesToday += 1;
      }
    });

    return { totalClasses, classesToday, totalStudents, activeClasses };
  }, [classes]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.userRow}>
              <View style={styles.avatarWrap}>
                <Image
                  source={require('../../assets/escudo_umb.png')}
                  style={styles.avatar}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={styles.userRole}>Docente</Text>
                <Text style={styles.userName}>{email || 'Docente'}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                logout();
                navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
              }}
              style={styles.logoutBtn}
            >
              <LogOut size={18} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.quickStats}>
            <View style={styles.quickCard}>
              <Text style={styles.quickValue}>{stats.classesToday}</Text>
              <Text style={styles.quickLabel}>Clases hoy</Text>
            </View>
            <View style={styles.quickCard}>
              <Text style={styles.quickValue}>{stats.totalClasses}</Text>
              <Text style={styles.quickLabel}>Mis clases</Text>
            </View>
            <View style={styles.quickCard}>
              <Text style={styles.quickValue}>{stats.totalStudents}</Text>
              <Text style={styles.quickLabel}>Estudiantes</Text>
            </View>
          </View>

          <View style={styles.quickActions}>
            <Pressable onPress={() => navigation.navigate('TeacherMyClasses')} style={styles.quickActionBtn}>
              <BookOpen size={18} color="#fff" />
              <Text style={styles.quickActionText}>Mis clases</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('TeacherCreateClass')} style={styles.quickActionBtn}>
              <PlusCircle size={18} color="#fff" />
              <Text style={styles.quickActionText}>Crear clase</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('TeacherCreateSession')} style={styles.quickActionBtn}>
              <ClipboardList size={18} color="#fff" />
              <Text style={styles.quickActionText}>Crear sesión</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <BookOpen size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Mis Clases</Text>
            </View>
            <View style={styles.sectionRight}>
              <Pressable
                onPress={loadClasses}
                disabled={loadingClasses}
                style={[styles.refreshBtn, loadingClasses ? styles.refreshBtnDisabled : null]}
              >
                <RefreshCw size={16} color={loadingClasses ? '#9CA3AF' : COLORS.primary} />
                <Text style={[styles.reportsText, loadingClasses ? { color: '#9CA3AF' } : null]}>Actualizar</Text>
              </Pressable>

              <Pressable onPress={() => navigation.navigate('ReportsDashboard')} style={styles.reportsBtn}>
                <BarChart3 size={16} color={COLORS.primary} />
                <Text style={styles.reportsText}>Reportes</Text>
              </Pressable>
            </View>
          </View>

          {loadingClasses ? (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingText}>Cargando tus clases…</Text>
            </View>
          ) : null}

          {!loadingClasses && classes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aún no tienes clases</Text>
              <Text style={styles.emptyText}>Crea una clase para comenzar.</Text>
              <View style={{ height: 10 }} />
              <Pressable onPress={() => navigation.navigate('TeacherCreateClass')} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>Crear clase</Text>
              </Pressable>
              <View style={{ height: 10 }} />
              <Pressable onPress={loadClasses} style={[styles.emptyBtn, { backgroundColor: '#F3F4F6' }]}>
                <Text style={[styles.emptyBtnText, { color: '#374151' }]}>Refrescar</Text>
              </Pressable>
            </View>
          ) : null}

          {classes.map((c, idx) => {
            const classId = c?.classId || c?.id || String(idx);
            const title = c?.className || c?.subject || c?.name || 'Clase';
            const group = c?.group || c?.groupName || c?.grupo || '';
            const room = c?.room || c?.classroom || c?.aula || '';
            const status = isClassInProgressNow(c) ? 'active' : 'pending';
            const scheduleText = formatSchedule(c);

            const studentsArr =
              (Array.isArray(c?.students) && c.students) ||
              (Array.isArray(c?.studentList) && c.studentList) ||
              (Array.isArray(c?.studentsList) && c.studentsList) ||
              (Array.isArray(c?.enrolledStudents) && c.enrolledStudents) ||
              (Array.isArray(c?.classStudents) && c.classStudents) ||
              (Array.isArray(c?.alumnos) && c.alumnos) ||
              (Array.isArray(c?.studentIds) && c.studentIds) ||
              (Array.isArray(c?.student_emails) && c.student_emails) ||
              (Array.isArray(c?.students?.items) && c.students.items) ||
              [];
            const studentsCount =
              Number(c?.studentsCount) ||
              Number(c?.studentCount) ||
              Number(c?.totalStudents) ||
              Number(c?.enrolledCount) ||
              Number(c?.enrolledStudentsCount) ||
              Number(c?.students_count) ||
              Number(c?.student_count) ||
              Number(c?.students?.count) ||
              Number(c?.students?.total) ||
              Number(c?.students?.length) ||
              Number(c?.class?.studentsCount) ||
              Number(studentsArr.length);

            return (
              <Pressable
                key={String(classId)}
                onPress={() => navigation.navigate('TeacherCreateClass', { classId })}
                style={styles.classCard}
              >
                <View style={styles.classTop}>
                  <View style={styles.classInfoRow}>
                    <View style={styles.classIcon}>
                      <BookOpen size={18} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.classTitle}>{title}</Text>
                      <Text style={styles.classSub}>
                        {group ? `Grupo ${group}` : 'Grupo'}
                        {room ? ` • Aula ${room}` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: getStatusColor(status) }]}>
                    <Text style={styles.statusText}>{getStatusText(status)}</Text>
                  </View>
                </View>

                {scheduleText ? (
                  <Text style={styles.classSchedule}>
                    <Clock size={14} color="#9CA3AF" /> {scheduleText}
                  </Text>
                ) : (
                  <Text style={styles.classSchedule}>
                    <Clock size={14} color="#9CA3AF" /> Horario no disponible
                  </Text>
                )}

                <View style={styles.attRow}>
                  <View style={styles.attItem}>
                    <Users size={14} color="#16A34A" />
                    <Text style={styles.attNum}>{studentsCount}</Text>
                  </View>
                  <Text style={styles.attTotal}>estudiantes</Text>
                </View>

                <View style={styles.actionsGrid}>
                  <Pressable
                    onPress={async (e) => {
                      e?.stopPropagation?.();
                      try {
                        const session = await createOrReuseTodaySession(classId);
                        if (!session) return;

                        navigation.navigate('TeacherFaceRecognitionScreen', {
                          classId,
                          attendanceSession: session,
                          classMeta: { title, group, room },
                          autoCapture: true
                        });
                      } catch (err) {
                        Alert.alert('Error', err?.message || String(err));
                      }
                    }}
                    style={[styles.actionBtn, { backgroundColor: '#F3E8FF' }]}
                  >
                    <Camera size={18} color="#7C3AED" />
                    <Text style={[styles.actionText, { color: '#7C3AED' }]}>Foto</Text>
                  </Pressable>

                  <Pressable
                    onPress={async (e) => {
                      e?.stopPropagation?.();
                      try {
                        // 🔍 Crear o reutilizar sesión del día de hoy
                        const session = await createOrReuseTodaySession(classId);
                        if (!session) return;
                        navigation.navigate('TeacherClassQRScreen', { classId, attendanceSession: session, classMeta: { title, group, room } });
                      } catch (err) {
                        Alert.alert('Error', err?.message || String(err));
                      }
                    }}
                    style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]}
                  >
                    <QrCode size={18} color="#EF4444" />
                    <Text style={[styles.actionText, { color: '#EF4444' }]}>Ver QR</Text>
                  </Pressable>

                  <Pressable
                    onPress={async (e) => {
                      e?.stopPropagation?.();
                      try {
                        // 🔍 Siempre ir a la última sesión (crear si no existe)
                        const session = await createOrReuseTodaySession(classId);
                        if (!session) return;
                        
                        // ✅ Siempre ir al dashboard con la sesión
                        navigation.navigate('TeacherLiveAttendanceDashboard', { 
                          sessionId: session.sessionId,
                          classId, 
                          attendanceSession: session, 
                          classMeta: { title, group, room } 
                        });
                      } catch (err) {
                        Alert.alert('Error', err?.message || String(err));
                      }
                    }}
                    style={[styles.actionBtn, { backgroundColor: '#E0F2FE' }]}
                  >
                    <Users size={18} color="#0284C7" />
                    <Text style={[styles.actionText, { color: '#0284C7' }]}>Asistencia</Text>
                  </Pressable>

                  <Pressable
                    onPress={async (e) => {
                      e?.stopPropagation?.();
                      Alert.alert(
                        'Eliminar Clase',
                        `¿Estás seguro que quieres eliminar la clase "${title}"?\n\nEsta acción eliminará:\n• Todos los estudiantes inscritos\n• Todas las sesiones de asistencia\n• Todos los registros de asistencia\n\nEsta acción no se puede deshacer.`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          { 
                            text: 'Eliminar', 
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                console.log('🔍 DEBUG: Eliminando clase - authToken:', authToken);
                                console.log('🔍 DEBUG: Eliminando clase - authToken length:', authToken?.length || 0);
                                console.log('🔍 DEBUG: Eliminando clase - authToken type:', typeof authToken);
                                console.log('🔍 DEBUG: Eliminando clase - DELETE_CLASS_URL:', DELETE_CLASS_URL);
                                
                                if (!DELETE_CLASS_URL || !authToken) {
                                  Alert.alert('Error', 'Configuración no disponible');
                                  return;
                                }

                                const headers = {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${authToken}`,
                                };
                                console.log('🔍 DEBUG: Eliminando clase - headers:', headers);

                                const response = await fetch(DELETE_CLASS_URL, {
                                  method: 'POST',
                                  headers,
                                  body: JSON.stringify({ classId }),
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
                                  'Clase Eliminada',
                                  json?.message || 'La clase fue eliminada exitosamente',
                                  [{ text: 'OK', onPress: () => loadClasses() }]
                                );
                              } catch (err) {
                                Alert.alert('Error', err?.message || String(err));
                              }
                            }
                          }
                        ]
                      );
                    }}
                    style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
                  >
                    <Trash size={18} color="#DC2626" />
                    <Text style={[styles.actionText, { color: '#DC2626' }]}>Eliminar</Text>
                  </Pressable>

                  <Pressable
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      // 📋 Ir al historial de sesiones
                      navigation.navigate('SessionHistory', {
                        classId,
                        className: title,
                        group,
                        room,
                      });
                    }}
                    style={[styles.actionBtn, { backgroundColor: '#FEF3C7' }]}
                  >
                    <Calendar size={18} color="#D97706" />
                    <Text style={[styles.actionText, { color: '#D97706' }]}>Historial</Text>
                  </Pressable>

                  <Pressable
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      navigation.navigate('InformeSessionsList', {
                        classId,
                        className: title,
                        group,
                        room,
                      });
                    }}
                    style={[styles.actionBtn, { backgroundColor: '#EFF6FF' }]}
                  >
                    <FileSpreadsheet size={18} color="#2563EB" />
                    <Text style={[styles.actionText, { color: '#2563EB' }]}>Informe</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Settings size={16} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Cómo funciona</Text>
              <Text style={styles.infoText}>
                1. Muestra el QR de tu clase para que los estudiantes marquen asistencia.\n2. Toma 1-2 fotos durante la clase para validar con reconocimiento facial.\n3. Modifica manualmente si es necesario.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 18 },
  header: { backgroundColor: COLORS.primary, paddingTop: 54, paddingHorizontal: 24, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: 40, height: 40 },
  userRole: { color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '700' },
  userName: { color: '#fff', fontSize: 16, fontWeight: '900' },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  quickStats: { marginTop: 14, flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  quickValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  quickLabel: { marginTop: 2, color: 'rgba(255,255,255,0.70)', fontSize: 12 },
  quickActions: { marginTop: 12, flexDirection: 'row', gap: 10 },
  quickActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  quickActionText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '900', color: '#1F2937' },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(185,28,28,0.06)' },
  refreshBtnDisabled: { opacity: 0.75 },
  reportsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reportsText: { color: COLORS.primary, fontWeight: '900' },
  classCard: { backgroundColor: '#fff', borderRadius: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2, overflow: 'hidden' },
  classTop: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  classInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  classIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(185,28,28,0.10)', alignItems: 'center', justifyContent: 'center' },
  classTitle: { fontWeight: '900', color: '#111827' },
  classSub: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  classSchedule: { paddingHorizontal: 14, paddingVertical: 10, color: '#9CA3AF' },
  attRow: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F9FAFB', flexDirection: 'row', alignItems: 'center', gap: 12 },
  attItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attNum: { fontWeight: '900', color: '#374151' },
  attTotal: { marginLeft: 'auto', color: '#9CA3AF', fontSize: 12 },
  actionsGrid: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  actionBtn: { flexBasis: '48%', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { fontWeight: '900', fontSize: 12 },
  infoCard: { marginTop: 4, backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#DBEAFE', flexDirection: 'row', gap: 12 },
  infoIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontWeight: '900', color: '#1E3A8A' },
  infoText: { marginTop: 4, color: '#2563EB', fontSize: 12, lineHeight: 16 },
  loadingCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  loadingText: { color: '#6B7280', fontWeight: '800' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  emptyTitle: { fontWeight: '900', color: '#111827', fontSize: 16 },
  emptyText: { marginTop: 6, color: '#6B7280', textAlign: 'center' },
  emptyBtn: { width: '100%', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  emptyBtnText: { color: '#fff', fontWeight: '900' },
});
