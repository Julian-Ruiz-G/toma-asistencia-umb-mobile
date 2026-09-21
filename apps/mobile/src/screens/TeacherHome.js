import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../ui/appNotice';
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  Camera,
  Clock,
  PlusCircle,
  FileSpreadsheet,
  LogOut,
  QrCode,
  Settings,
  Trash,
  User,
  Users,
  X,
} from 'lucide-react-native';

import { COLORS } from '../ui/theme';
import { useAppTheme, useColors } from '../ui/ThemeContext';
import Animated, { enterDown, listEnter } from '../ui/motion';
import { useAuth } from '../state/auth';
import { CLASS_DETAILS_URL, CREATE_ATTENDANCE_QR_URL, MARK_NOTIFICATIONS_READ_URL, MY_CLASSES_URL, DELETE_CLASS_URL, SET_CONSENT_URL, STUDENT_NOTIFICATIONS_URL } from '../config';
import { personDisplayName } from '../utils/displayName';
import { alertAttendanceQrError } from '../utils/attendanceQr';
import {
  classStatusMeta,
  formatScheduleFriendly,
  getClassSchedule,
  isClassInProgressNow,
  isClassScheduledToday,
  scheduleHoursForYmd,
} from '../utils/schedule';
import { colombiaDateLongFromYmd, colombiaNowMinutes, colombiaTodayYmd, colombiaWeekdayLongFromYmd } from '../utils/formatDateTime';
import OverlayDismiss from '../components/OverlayDismiss';
import TermsAndConditionsModal from '../components/TermsAndConditions';
import PrivacyPolicyModal from '../components/PrivacyPolicy';
import { loadLocalProfile, loadPersistedSession, saveLocalProfile } from '../utils/sessionStore';
import { loadTeacherAlerts, syncTeacherAlerts, teacherAlertIsDue } from '../utils/teacherAlerts';

function classCardMeta(c, idx) {
  return {
    classId: c?.classId || c?.id || String(idx),
    title: c?.className || c?.subject || c?.name || 'Clase',
    group: c?.group || c?.groupName || c?.grupo || '',
    room: c?.room || c?.classroom || c?.aula || '',
    raw: c,
  };
}

function timeToMinutes(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function remainingLabel(endTime) {
  const endMin = timeToMinutes(endTime);
  if (endMin == null) return '';
  const left = endMin - colombiaNowMinutes();
  if (left <= 0) return 'Termina ahora';
  if (left < 60) return `${left} min restantes`;
  const hours = Math.floor(left / 60);
  const mins = left % 60;
  return mins ? `${hours} h ${mins} min restantes` : `${hours} h restantes`;
}

const STAT_PANELS = {
  today: {
    title: 'Clases hoy',
    empty: 'Hoy no tienes clases en el horario.',
  },
  all: {
    title: 'Mis clases',
    empty: 'Aún no tienes clases creadas.',
  },
  live: {
    title: 'En curso',
    empty: 'Ninguna clase está en curso ahora.',
  },
};

export default function TeacherHome({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { inAppNotifications } = useAppTheme();
  const { logout, authToken, fullName, email, photoUri, setPhotoUri, notificationUnread, setNotificationUnread, acceptTerms, setAcceptTerms, acceptPrivacy, setAcceptPrivacy, persistSession } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [statsPanel, setStatsPanel] = useState(null);
  const [adminNotice, setAdminNotice] = useState(null);
  const legalStep = acceptTerms !== true ? 'terms' : acceptPrivacy !== true ? 'privacy' : null;

  const saveLegalConsent = async (fields) => {
    try {
      if (SET_CONSENT_URL && authToken) {
        await fetch(SET_CONSENT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(fields),
        });
      }
    } catch {
      // still mark locally so the teacher can use the app on this device
    }
    if (fields.acceptTerms) setAcceptTerms(true);
    if (fields.acceptPrivacy) setAcceptPrivacy(true);
    await saveLocalProfile(email, fields);
    try {
      const saved = await loadPersistedSession();
      if (saved) await persistSession({ ...saved, ...fields });
    } catch {
      // ignore
    }
  };

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

      const arr = json?.classes || json?.myClasses || json || [];
      const list = Array.isArray(arr) ? arr : [];
      setClasses(list);
      await syncTeacherAlerts(email, list).catch(() => {});
      await loadAdminNotice();
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadAdminNotice = async () => {
    let serverUnread = 0;
    let admin = null;
    if (authToken && STUDENT_NOTIFICATIONS_URL) {
      try {
        const resp = await fetch(STUDENT_NOTIFICATIONS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({}),
        });
        const json = await resp.json().catch(() => null);
        if (resp.ok) {
          const list = Array.isArray(json?.notifications) ? json.notifications : [];
          admin = list.find((n) => String(n?.action || '') === 'admin_request' && !n?.read) || null;
          serverUnread = list.filter((n) => !n?.read).length;
        }
      } catch {
        // ignore
      }
    }
    setAdminNotice(admin);
    let localUnread = 0;
    try {
      const stored = await loadTeacherAlerts(email);
      localUnread = (stored.alerts || []).filter((a) => teacherAlertIsDue(a) && !a.read).length;
    } catch {
      localUnread = 0;
    }
    setNotificationUnread(inAppNotifications ? serverUnread + localUnread : 0);
  };

  const openAdminNotice = () => {
    const notice = adminNotice;
    if (!notice) return;
    if (notice.id && authToken && MARK_NOTIFICATIONS_READ_URL) {
      fetch(MARK_NOTIFICATIONS_READ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ ids: [notice.id] }),
      }).catch(() => {});
    }
    setAdminNotice(null);
    navigation.navigate('TeacherProfile', {
      forceEdit: (notice.open || 'edit') === 'edit',
      open: notice.open || 'edit',
    });
  };

  useEffect(() => {
    loadClasses();
    loadAdminNotice();
    (async () => {
      const local = await loadLocalProfile(email);
      if (local?.photoUri) setPhotoUri(String(local.photoUri));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsub = navigation?.addListener?.('focus', () => {
      loadClasses();
      loadAdminNotice();
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

  const todayYmd = colombiaTodayYmd();
  const panelCopy = statsPanel ? STAT_PANELS[statsPanel] : null;
  const panelClasses = useMemo(() => {
    if (statsPanel === 'today') return classes.filter((c) => isClassScheduledToday(c));
    if (statsPanel === 'live') return classes.filter((c) => isClassInProgressNow(c));
    if (statsPanel === 'all') return classes;
    return [];
  }, [classes, statsPanel]);

  const panelSubtitle = useMemo(() => {
    if (statsPanel === 'today' || statsPanel === 'live') {
      const weekday = colombiaWeekdayLongFromYmd(todayYmd);
      const date = colombiaDateLongFromYmd(todayYmd);
      return [weekday, date].filter(Boolean).join(', ');
    }
    if (statsPanel === 'all') {
      const todayCount = classes.filter((c) => isClassScheduledToday(c)).length;
      const liveCount = classes.filter((c) => isClassInProgressNow(c)).length;
      return `${classes.length} en total · ${todayCount} hoy · ${liveCount} en curso`;
    }
    return '';
  }, [classes, statsPanel, todayYmd]);

  const openClassFromPanel = (classId) => {
    setStatsPanel(null);
    navigation.navigate('TeacherClassDetails', { classId });
  };

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
              <LogOut size={18} color={COLORS.white} />
            </Pressable>
          </View>

          <View style={styles.quickStats}>
            <Pressable onPress={() => setStatsPanel('today')} style={styles.quickCard}>
              <Text style={styles.quickValue}>{stats.classesToday}</Text>
              <Text style={styles.quickLabel}>Clases hoy</Text>
            </Pressable>
            <Pressable onPress={() => setStatsPanel('all')} style={styles.quickCard}>
              <Text style={styles.quickValue}>{stats.totalClasses}</Text>
              <Text style={styles.quickLabel}>Mis clases</Text>
            </Pressable>
            <Pressable onPress={() => setStatsPanel('live')} style={styles.quickCard}>
              <Text style={styles.quickValue}>{stats.inSession}</Text>
              <Text style={styles.quickLabel}>En curso</Text>
            </Pressable>
          </View>

          <View style={styles.quickActions}>
            <Pressable onPress={() => navigation.navigate('TeacherMyClasses')} style={styles.quickActionBtn}>
              <BookOpen size={18} color={COLORS.white} />
              <Text style={styles.quickActionText}>Mis clases</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('TeacherCreateClass')} style={styles.quickActionBtn}>
              <PlusCircle size={18} color={COLORS.white} />
              <Text style={styles.quickActionText}>Crear clase</Text>
            </Pressable>
          </View>

          <View style={styles.quickActions}>
            <Pressable onPress={() => navigation.navigate('TeacherProfile')} style={styles.quickActionBtn}>
              <User size={18} color={COLORS.white} />
              <Text style={styles.quickActionText}>Perfil</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('TeacherNotifications')} style={styles.quickActionBtn}>
              <Bell size={18} color={COLORS.white} />
              <Text style={styles.quickActionText}>Notificaciones</Text>
              {inAppNotifications && notificationUnread > 0 ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{notificationUnread > 9 ? '9+' : String(notificationUnread)}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </Animated.View>

        <View style={styles.body}>
          {adminNotice ? (
            <Pressable onPress={openAdminNotice} style={styles.noticeCard}>
              <View style={styles.noticeIcon}>
                <Bell size={18} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>{adminNotice.title || 'Completa tus datos'}</Text>
                <Text style={styles.noticeText}>{adminNotice.message}</Text>
              </View>
            </Pressable>
          ) : null}

          <Animated.View entering={enterDown(80)} style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <BookOpen size={18} color={COLORS.icon} />
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
              <Pressable onPress={loadClasses} style={[styles.emptyBtn, { backgroundColor: COLORS.surface }]}>
                <Text style={[styles.emptyBtnText, { color: COLORS.textSecondary }]}>Refrescar</Text>
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
                    <Clock size={14} color={COLORS.placeholder} /> {scheduleText}
                  </Text>
                ) : (
                  <Text style={styles.classSchedule}>
                    <Clock size={14} color={COLORS.placeholder} /> Sin horario asignado
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
                    style={styles.actionBtn}
                  >
                    <Camera size={18} color={COLORS.icon} />
                    <Text style={styles.actionText}>Foto</Text>
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
                    style={styles.actionBtn}
                  >
                    <QrCode size={18} color={COLORS.icon} />
                    <Text style={styles.actionText}>Ver QR</Text>
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
                    style={styles.actionBtn}
                  >
                    <Users size={18} color={COLORS.icon} />
                    <Text style={styles.actionText}>Asistencia</Text>
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
                    style={styles.actionBtn}
                  >
                    <Calendar size={18} color={COLORS.icon} />
                    <Text style={styles.actionText}>Historial</Text>
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
                    style={styles.actionBtn}
                  >
                    <FileSpreadsheet size={18} color={COLORS.icon} />
                    <Text style={styles.actionText}>Informe</Text>
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
                    style={[styles.actionBtn, styles.actionBtnDanger]}
                  >
                    <Trash size={18} color={COLORS.dangerStrong} />
                    <Text style={[styles.actionText, styles.actionTextDanger]}>Eliminar</Text>
                  </Pressable>
                </View>
              </Pressable>
              </Animated.View>
            );
          })}

          <Pressable onPress={() => navigation.navigate('TeacherAttendanceGuide')} style={styles.guideBtn}>
            <View style={styles.guideIcon}>
              <Settings size={18} color={COLORS.icon} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guideTitle}>Cómo funciona</Text>
              <Text style={styles.guideSub}>Guía de QR, foto y horario de clase</Text>
            </View>
            <Text style={styles.guideCta}>Ver guía</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={!!statsPanel}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setStatsPanel(null)}
      >
        <OverlayDismiss style={styles.sheetRoot} onClose={() => setStatsPanel(null)}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{panelCopy?.title}</Text>
                {panelSubtitle ? <Text style={styles.sheetSub}>{panelSubtitle}</Text> : null}
              </View>
              <Pressable onPress={() => setStatsPanel(null)} style={styles.sheetClose} hitSlop={8}>
                <X size={18} color={COLORS.icon} />
              </Pressable>
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
              {panelClasses.length === 0 ? (
                <Text style={styles.sheetEmpty}>{panelCopy?.empty}</Text>
              ) : panelClasses.map((c, idx) => {
                const meta = classCardMeta(c, idx);
                const status = classStatusMeta(c);
                const hours = scheduleHoursForYmd(getClassSchedule(c), todayYmd);
                const todayHours = hours.startTime && hours.endTime ? `${hours.startTime} – ${hours.endTime}` : '';
                const weekly = formatScheduleFriendly(c);
                const remaining = statsPanel === 'live' ? remainingLabel(hours.endTime) : '';
                const line = statsPanel === 'all'
                  ? (weekly || 'Sin horario asignado')
                  : (todayHours || weekly || 'Sin horario asignado');
                const extra = [
                  meta.group ? `Grupo ${meta.group}` : '',
                  meta.room ? `Aula ${meta.room}` : '',
                  remaining,
                ].filter(Boolean).join(' · ');

                return (
                  <Pressable
                    key={String(meta.classId)}
                    onPress={() => openClassFromPanel(meta.classId)}
                    style={styles.sheetItem}
                  >
                    <View style={styles.sheetItemIcon}>
                      <BookOpen size={16} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetItemTitle} numberOfLines={1}>{meta.title}</Text>
                      <Text style={styles.sheetItemMeta} numberOfLines={2}>{extra ? `${extra}\n${line}` : line}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: status.pillBg, borderWidth: 1, borderColor: status.pillBorder }]}>
                      <Text style={[styles.statusText, { color: status.pillText }]}>{status.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </OverlayDismiss>
      </Modal>
      <TermsAndConditionsModal
        visible={legalStep === 'terms'}
        blocking
        onClose={() => {}}
        onAccept={() => saveLegalConsent({ acceptTerms: true })}
      />
      <PrivacyPolicyModal
        visible={legalStep === 'privacy'}
        blocking
        onClose={() => {}}
        onAccept={() => saveLegalConsent({ acceptPrivacy: true })}
      />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 18 },
  header: { backgroundColor: COLORS.primary, paddingTop: 54, paddingHorizontal: 24, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 12 },
  avatarWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: 40, height: 40 },
  avatarPhoto: { width: 48, height: 48 },
  userRole: { color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '700' },
  userName: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  quickStats: { marginTop: 14, flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  quickValue: { color: COLORS.white, fontSize: 22, fontWeight: '900' },
  quickLabel: { marginTop: 2, color: 'rgba(255,255,255,0.70)', fontSize: 12 },
  quickActions: { marginTop: 12, flexDirection: 'row', gap: 10 },
  quickActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  quickActionText: { color: COLORS.white, fontWeight: '900', fontSize: 12 },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: { color: COLORS.primary, fontSize: 10, fontWeight: '900' },
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.warningSoft,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: 16,
    padding: 12,
  },
  noticeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.warningStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: { fontWeight: '900', color: COLORS.text },
  noticeText: { marginTop: 2, color: COLORS.textSecondary, fontSize: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '900', color: COLORS.text },
  reportsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reportsText: { color: COLORS.primary, fontWeight: '900' },
  classCard: { backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.black, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2, overflow: 'hidden' },
  classTop: { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  classInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  classIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  classTitle: { fontWeight: '900', color: COLORS.text },
  classSub: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontWeight: '900', fontSize: 11 },
  classSchedule: { paddingHorizontal: 14, paddingVertical: 10, color: COLORS.placeholder },
  attRow: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.background, flexDirection: 'row', alignItems: 'center', gap: 12 },
  attItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attNum: { fontWeight: '900', color: COLORS.textSecondary },
  attTotal: { marginLeft: 'auto', color: COLORS.placeholder, fontSize: 12 },
  actionsGrid: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  actionBtn: { flexBasis: '48%', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  actionBtnDanger: { backgroundColor: COLORS.dangerBg },
  actionText: { fontWeight: '900', fontSize: 12, color: COLORS.textSecondary },
  actionTextDanger: { color: COLORS.dangerStrong },
  loadingCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  loadingText: { color: COLORS.muted, fontWeight: '800' },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  emptyTitle: { fontWeight: '900', color: COLORS.text, fontSize: 16 },
  emptyText: { marginTop: 6, color: COLORS.muted, textAlign: 'center' },
  emptyBtn: { width: '100%', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  emptyBtnText: { color: COLORS.white, fontWeight: '900' },
  guideBtn: {
    marginTop: 4,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guideIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  guideTitle: { fontWeight: '900', color: COLORS.text },
  guideSub: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  guideCta: { fontWeight: '900', color: COLORS.primary, fontSize: 12 },
  sheetRoot: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  sheetCard: {
    width: '100%',
    maxHeight: '74%',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    zIndex: 2,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  sheetSub: { marginTop: 4, color: COLORS.muted, fontWeight: '700', fontSize: 13 },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: { flexGrow: 0 },
  sheetList: { paddingBottom: 8, gap: 8 },
  sheetEmpty: { textAlign: 'center', color: COLORS.muted, fontWeight: '700', paddingVertical: 28 },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetItemTitle: { fontWeight: '900', color: COLORS.text },
  sheetItemMeta: { marginTop: 2, color: COLORS.muted, fontSize: 12, lineHeight: 16 },
});
