import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import {
  ArrowLeft,
  Bell,
  Camera,
  CheckCheck,
  Clock,
  Info,
  AlertTriangle,
  Trash2,
  Users,
} from 'lucide-react-native';

import { useAppTheme, useColors } from '../../ui/ThemeContext';
import Animated, { enterDown, listEnter } from '../../ui/motion';
import { CREATE_ATTENDANCE_QR_URL, MARK_NOTIFICATIONS_READ_URL, STUDENT_NOTIFICATIONS_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { formatActionDateTime } from '../../utils/formatDateTime';
import { alertAttendanceQrError } from '../../utils/attendanceQr';
import {
  loadTeacherAlerts,
  saveTeacherAlerts,
  teacherAlertCopy,
  teacherAlertIsDue,
} from '../../utils/teacherAlerts';

function mapNotification(n, idx) {
  const raw = String(n?.type || 'info');
  let type = 'info';
  if (raw === 'success' || raw === 'asistencia') type = 'success';
  else if (raw === 'warning' || raw === 'retardo') type = 'warning';
  else if (raw === 'attendance' || raw === 'inasistencia') type = 'attendance';
  else if (raw === 'teacherPhoto') type = 'photo';
  else if (raw === 'teacherEnd') type = 'attendance';
  else if (raw === 'teacherSoon') type = 'info';
  return {
    id: String(n?.id || idx),
    title: String(n?.title || 'Notificación'),
    message: String(n?.message || ''),
    type,
    time: formatActionDateTime(n?.createdAt || n?.time, String(n?.time || 'Hoy')),
    read: Boolean(n?.read),
    classId: n?.classId ? String(n.classId) : '',
    action: String(n?.action || ''),
    open: String(n?.open || ''),
    kind: String(n?.kind || n?.action || ''),
    className: String(n?.className || ''),
    group: String(n?.group || ''),
    room: String(n?.room || ''),
  };
}

function asLocalNotice(alert) {
  const copy = teacherAlertCopy(alert);
  const type = alert.kind === 'teacherPhoto' ? 'photo' : alert.kind === 'teacherEnd' ? 'attendance' : 'info';
  return {
    id: alert.id,
    title: copy.title,
    message: copy.message,
    type,
    time: alert.time || 'Hoy',
    read: Boolean(alert.read),
    local: true,
    classId: alert.classId,
    open: alert.open,
    kind: alert.kind,
    className: alert.className,
    group: alert.group,
    room: alert.room,
    startAt: alert.startAt,
    endAt: alert.endAt,
  };
}

export default function TeacherNotifications({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { inAppNotifications } = useAppTheme();
  const { authToken, email, setNotificationUnread } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const alertIdsRef = useRef([]);
  const locallyReadRef = useRef(new Set());
  const [openingId, setOpeningId] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadServer = async ({ silent } = {}) => {
      if (!authToken || !STUDENT_NOTIFICATIONS_URL) {
        if (!silent) setLoading(false);
        return;
      }
      try {
        if (!silent) setLoading(true);
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
        if (!resp.ok) {
          const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
          const unauthorized = resp.status === 401 || String(msg).toLowerCase().includes('unauthorized');
          if (unauthorized) {
            if (!cancelled) setNotifications([]);
            return;
          }
          throw new Error(msg);
        }
        const arr = Array.isArray(json?.notifications) ? json.notifications : [];
        if (!cancelled) {
          setNotifications(arr.map(mapNotification).map((n) => (
            locallyReadRef.current.has(n.id) ? { ...n, read: true } : n
          )));
        }
      } catch (e) {
        if (!silent && !cancelled) {
          appAlert('Error', e?.message || String(e));
          setNotifications([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadLocal = async () => {
      const stored = await loadTeacherAlerts(email);
      if (cancelled) return;
      setAlerts(Array.isArray(stored.alerts) ? stored.alerts : []);
      alertIdsRef.current = Array.isArray(stored.notificationIds) ? stored.notificationIds : [];
    };

    loadServer();
    loadLocal();
    const timer = setInterval(() => {
      loadServer({ silent: true });
      loadLocal();
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authToken, email]);

  const localNotices = useMemo(
    () => alerts.filter(teacherAlertIsDue).map(asLocalNotice),
    [alerts]
  );

  const displayedNotifications = useMemo(() => {
    if (!inAppNotifications) return [];
    const extra = [...localNotices];
    const ids = new Set(extra.map((n) => n.id));
    return [
      ...extra,
      ...notifications.filter((n) => !ids.has(n.id)),
    ];
  }, [inAppNotifications, localNotices, notifications]);

  const unreadCount = useMemo(
    () => displayedNotifications.filter((n) => !n.read).length,
    [displayedNotifications]
  );

  useEffect(() => {
    if (!inAppNotifications) {
      setNotificationUnread(0);
      return;
    }
    const serverUnread = notifications.filter((n) => !n.read).length;
    const localUnread = alerts.filter((a) => teacherAlertIsDue(a) && !a.read).length;
    setNotificationUnread(serverUnread + localUnread);
  }, [inAppNotifications, notifications, alerts, setNotificationUnread]);

  const persistRead = async ({ ids, all } = {}) => {
    if (!authToken || !MARK_NOTIFICATIONS_READ_URL) return;
    try {
      await fetch(MARK_NOTIFICATIONS_READ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(all ? { all: true } : { ids: ids || [] }),
      });
    } catch {
      // ignore
    }
  };

  const persistLocal = (next) => {
    setAlerts(next);
    saveTeacherAlerts(email, { alerts: next, notificationIds: alertIdsRef.current });
  };

  const markAllAsRead = () => {
    notifications.forEach((n) => locallyReadRef.current.add(n.id));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    persistLocal(alerts.map((a) => ({ ...a, read: true })));
    persistRead({ all: true });
  };

  const markOneRead = (id) => {
    if (String(id).startsWith('teacher')) {
      persistLocal(alerts.map((a) => (a.id === id ? { ...a, read: true } : a)));
      return;
    }
    locallyReadRef.current.add(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    persistRead({ ids: [id] });
  };

  const deleteNotification = (id) => {
    if (String(id).startsWith('teacher')) {
      persistLocal(alerts.filter((a) => a.id !== id));
      return;
    }
    locallyReadRef.current.add(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    persistRead({ ids: [id] });
  };

  const ensureSession = async (classId) => {
    if (!CREATE_ATTENDANCE_QR_URL) {
      appAlert('API no configurada', 'Falta CREATE_ATTENDANCE_QR_URL');
      return null;
    }
    if (!authToken) {
      appAlert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return null;
    }
    const resp = await fetch(CREATE_ATTENDANCE_QR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ classId }),
    });
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    if (!resp.ok) {
      if (alertAttendanceQrError(json)) return null;
      throw new Error((json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`);
    }
    return json;
  };

  const openNotification = async (n) => {
    if (!n.read) markOneRead(n.id);
    if (n.action === 'admin_request' || n.open === 'terms' || n.open === 'privacy' || n.open === 'edit') {
      navigation.navigate('TeacherProfile', {
        forceEdit: (n.open || 'edit') === 'edit',
        open: n.open || 'edit',
      });
      return;
    }
    const classId = n.classId;
    const classMeta = { title: n.className || 'Clase', group: n.group || '', room: n.room || '' };
    const kind = n.kind || n.open;
    const live = Number(n.startAt || 0) && Date.now() >= Number(n.startAt);
    if (!classId) return;
    if (kind === 'teacherPhoto' || kind === 'photo' || (kind === 'teacherSoon' && live)) {
      try {
        setOpeningId(n.id);
        const session = await ensureSession(classId);
        if (!session) return;
        navigation.navigate('TeacherFaceRecognitionScreen', {
          classId,
          attendanceSession: session,
          classMeta,
          autoCapture: true,
        });
      } catch (e) {
        appAlert('Error', e?.message || String(e));
      } finally {
        setOpeningId('');
      }
      return;
    }
    if (kind === 'teacherEnd' || kind === 'attendance') {
      try {
        setOpeningId(n.id);
        const session = await ensureSession(classId);
        if (!session) return;
        navigation.navigate('TeacherLiveAttendanceDashboard', {
          sessionId: session.sessionId,
          classId,
          attendanceSession: session,
          classMeta,
        });
      } catch (e) {
        appAlert('Error', e?.message || String(e));
      } finally {
        setOpeningId('');
      }
      return;
    }
    navigation.navigate('TeacherClassDetails', { classId });
  };

  const getConfig = (type) => {
    switch (type) {
      case 'photo':
        return { Icon: Camera, bg: COLORS.primarySoft, border: COLORS.primaryBorder, iconBg: COLORS.primary };
      case 'success':
        return { Icon: CheckCheck, bg: COLORS.successSoft, border: COLORS.successBorder, iconBg: COLORS.successStrong };
      case 'warning':
        return { Icon: AlertTriangle, bg: COLORS.warningSoft, border: COLORS.warningBorder, iconBg: COLORS.warningStrong };
      case 'attendance':
        return { Icon: Users, bg: COLORS.infoSoft, border: COLORS.infoBorder, iconBg: COLORS.infoStrong };
      default:
        return { Icon: Clock, bg: COLORS.reminderSoft, border: COLORS.reminderBorder, iconBg: COLORS.reminder };
    }
  };

  const renderItem = (n, idx) => {
    const cfg = getConfig(n.type);
    const busy = openingId === n.id;
    return (
      <Animated.View key={n.id} entering={listEnter(idx)}>
        <Pressable
          onPress={() => openNotification(n)}
          disabled={busy}
          style={[
            styles.item,
            { borderColor: n.read ? COLORS.border : cfg.border, backgroundColor: n.read ? COLORS.card : cfg.bg },
          ]}
        >
          <View style={[styles.itemIconWrap, { backgroundColor: cfg.iconBg }]}>
            <cfg.Icon size={20} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.itemTopRow}>
              <Text style={[styles.itemTitle, { color: n.read ? COLORS.textSecondary : COLORS.text }]}>
                {busy ? 'Abriendo…' : n.title}
              </Text>
              {!n.read ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={[styles.itemMsg, { color: n.read ? COLORS.muted : COLORS.textSecondary }]}>{n.message}</Text>
            <View style={styles.itemBottomRow}>
              <Text style={styles.itemTime}>{n.time}</Text>
              <Pressable onPress={() => deleteNotification(n.id)} style={styles.trashBtn}>
                <Trash2 size={18} color={COLORS.placeholder} />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={enterDown(0, 360)} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          <Text style={styles.headerSubtitle}>
            {loading ? 'Cargando...' : unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}
          </Text>
        </View>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllAsRead} style={styles.headerAction}>
            <Text style={styles.headerActionText}>Marcar todas</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.emptyText}>Cargando notificaciones...</Text>
          </View>
        ) : !inAppNotifications ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Bell size={40} color={COLORS.placeholder} />
            </View>
            <Text style={styles.emptyTitle}>Notificaciones en la app desactivadas</Text>
            <Text style={styles.emptyText}>Actívalas en Perfil para ver avisos y distintivos aquí.</Text>
          </View>
        ) : displayedNotifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Info size={40} color={COLORS.placeholder} />
            </View>
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptyText}>Te avisaremos antes de cada clase, para tomar la foto y al cerrar asistencia.</Text>
          </View>
        ) : (
          displayedNotifications.map((n, idx) => renderItem(n, idx))
        )}
        <View style={{ height: 12 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 12, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: COLORS.muted },
  headerAction: { paddingVertical: 8, paddingHorizontal: 10 },
  headerActionText: { color: COLORS.primary, fontWeight: '800' },
  body: { paddingHorizontal: 24, paddingVertical: 18, paddingBottom: 28 },
  emptyWrap: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: COLORS.textSecondary, textAlign: 'center' },
  emptyText: { marginTop: 6, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 12 },
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: COLORS.card,
    shadowColor: COLORS.black,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
    marginBottom: 12,
  },
  itemIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemTitle: { fontSize: 14, fontWeight: '900', flex: 1, paddingRight: 10 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 5 },
  itemMsg: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  itemBottomRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTime: { fontSize: 12, color: COLORS.placeholder },
  trashBtn: { padding: 6, borderRadius: 10 },
});
