import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../ui/appNotice';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Calendar,
  Camera,
  ClipboardList,
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
import Animated, { enterDown, listEnter } from '../ui/motion';
import { useAuth } from '../state/auth';
import { CLASS_DETAILS_URL, CREATE_ATTENDANCE_QR_URL, MY_CLASSES_URL, DELETE_CLASS_URL } from '../config';
import { personDisplayName } from '../utils/displayName';
import { loadLocalProfile } from '../utils/sessionStore';
import { alertAttendanceQrError } from '../utils/attendanceQr';
import { classStatusMeta, formatScheduleFriendly, isClassInProgressNow, isClassScheduledToday } from '../utils/schedule';
import { colombiaTodayYmd } from '../utils/formatDateTime';

export default function TeacherHome({ navigation }) {
  const { logout, authToken, fullName, email, photoUri, setPhotoUri } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const createAttendanceSession = async (classId) => {
    if (!CREATE_ATTENDANCE_QR_URL) {
      appAlert('API no configurada', 'Falta CREATE_ATTENDANCE_QR_URL');
      return null;
    }
    if (!authToken) {
      appAlert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return null;
    }
    if (!classId) {
      appAlert('Error', 'classId inválido');
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
        if (alertAttendanceQrError(json)) return null;
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      return json;
    } catch (err) {
      if (String(err?.message || '') !== 'HOURS_NOTICE') {
        appAlert('Error', err?.message || String(err));
      }
      return null;
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
            // 📅 Verificar si la sesión es del día de hoy (Colombia)
            const today = colombiaTodayYmd();
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
              const today = colombiaTodayYmd();
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
    return createAttendanceSession(classId);
  };

  const loadClasses = async () => {
    if (!MY_CLASSES_URL) {
      appAlert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }
    if (!authToken) {
      appAlert('Sesión inválida', 'Vuelve a iniciar sesión.');
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
      appAlert('Error', e?.message || String(e));
    } finally {
      setLoadingClasses(false);
    }
  };
  useEffect(() => {
    loadClasses();
    (async () => {
      const local = await loadLocalProfile(email);
      if (local?.photoUri) setPhotoUri(String(local.photoUri));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsub = navigation?.addListener?.('focus', () => {
      loadClasses();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const stats = useMemo(() => {
    const totalClasses = classes.length;
    let classesToday = 0;
    let inSession = 0;
    classes.forEach((c) => {
      if (isClassScheduledToday(c)) classesToday += 1;
      if (isClassInProgressNow(c)) inSession += 1;
    });
    return { totalClasses, classesToday, inSession };
  }, [classes]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={enterDown(0, 400)} style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.userRow}>
              <Pressable onPress={() => navigation.navigate('TeacherProfile')} style={styles.avatarWrap}>
                <Image
                  key={photoUri || 'default'}
                  source={photoUri ? { uri: photoUri } : require('../../assets/escudo_umb.png')}
                  style={photoUri ? styles.avatarPhoto : styles.avatar}
                  resizeMode={photoUri ? 'cover' : 'contain'}
                />
              </Pressable>
              <View>
                <Text style={styles.userRole}>Docente</Text>
                <Text style={styles.userName}>{personDisplayName(fullName, 'Docente')}</Text>
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
              <Text style={styles.quickValue}>{stats.inSession}</Text>
              <Text style={styles.quickLabel}>En curso</Text>
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
          </View>
        </Animated.View>

        <View style={styles.body}>
          <Animated.View entering={enterDown(80)} style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <BookOpen size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Mis Clases</Text>
            </View>
            <Pressable onPress={() => navigation.navigate('ReportsDashboard')} style={styles.reportsBtn}>
              <BarChart3 size={16} color={COLORS.primary} />
              <Text style={styles.reportsText}>Reportes</Text>
            </Pressable>
          </Animated.View>

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
            const status = classStatusMeta(c);
            const scheduleText = formatScheduleFriendly(c);

            return (
              <Animated.View key={String(classId)} entering={listEnter(idx)}>
              <Pressable
                onPress={() => navigation.navigate('TeacherClassDetails', { classId })}
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
                  <View style={[styles.statusPill, { backgroundColor: status.pillBg, borderWidth: 1, borderColor: status.pillBorder }]}>
                    <Text style={[styles.statusText, { color: status.pillText }]}>{status.label}</Text>
                  </View>
                </View>

                {scheduleText ? (
                  <Text style={styles.classSchedule}>
                    <Clock size={14} color="#9CA3AF" /> {scheduleText}
                  </Text>
                ) : (
                  <Text style={styles.classSchedule}>
                    <Clock size={14} color="#9CA3AF" /> Sin horario asignado
                  </Text>
                )}

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
                        appAlert('Error', err?.message || String(err));
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
                        appAlert('Error', err?.message || String(err));
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
                        appAlert('Error', err?.message || String(err));
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
                      appAlert(
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
                                  appAlert('Error', 'Configuración no disponible');
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

                                appAlert(
                                  'Clase Eliminada',
                                  json?.message || 'La clase fue eliminada exitosamente',
                                  [{ text: 'OK', onPress: () => loadClasses() }]
                                );
                              } catch (err) {
                                appAlert('Error', err?.message || String(err));
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
              </Animated.View>
            );
          })}

          <Pressable onPress={() => navigation.navigate('TeacherAttendanceGuide')} style={styles.guideBtn}>
            <View style={styles.guideIcon}>
              <Settings size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guideTitle}>Cómo funciona</Text>
              <Text style={styles.guideSub}>Guía de QR, foto y horario de clase</Text>
            </View>
            <Text style={styles.guideCta}>Ver guía</Text>
          </Pressable>
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
  avatarPhoto: { width: 48, height: 48 },
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
  statusText: { fontWeight: '900', fontSize: 11 },
  classSchedule: { paddingHorizontal: 14, paddingVertical: 10, color: '#9CA3AF' },
  attRow: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F9FAFB', flexDirection: 'row', alignItems: 'center', gap: 12 },
  attItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attNum: { fontWeight: '900', color: '#374151' },
  attTotal: { marginLeft: 'auto', color: '#9CA3AF', fontSize: 12 },
  actionsGrid: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  actionBtn: { flexBasis: '48%', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { fontWeight: '900', fontSize: 12 },
  guideBtn: {
    marginTop: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guideIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  guideTitle: { fontWeight: '900', color: '#1E3A8A' },
  guideSub: { marginTop: 2, color: '#2563EB', fontSize: 12 },
  guideCta: { fontWeight: '900', color: '#2563EB', fontSize: 12 },
  loadingCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  loadingText: { color: '#6B7280', fontWeight: '800' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  emptyTitle: { fontWeight: '900', color: '#111827', fontSize: 16 },
  emptyText: { marginTop: 6, color: '#6B7280', textAlign: 'center' },
  emptyBtn: { width: '100%', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  emptyBtnText: { color: '#fff', fontWeight: '900' },
});
