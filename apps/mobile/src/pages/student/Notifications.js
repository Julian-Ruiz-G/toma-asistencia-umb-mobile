import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Info,
  AlertTriangle,
  Clock,
  Trash2,
} from 'lucide-react-native';
import { COLORS } from '../../ui/theme';
import { useAppTheme, useColors } from '../../ui/ThemeContext';
import Animated, { enterDown, listEnter } from '../../ui/motion';
import { STUDENT_NOTIFICATIONS_URL, MARK_NOTIFICATIONS_READ_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { formatActionDateTime } from '../../utils/formatDateTime';
import { isStudentProfileComplete, studentProfileIncompleteMessage } from '../../utils/studentProfile';
import {
  loadReminders,
  reminderDates,
  reminderIsDue,
  saveReminders,
} from '../../utils/remindersStore';
import { classSoonIsDue, loadClassSoon, saveClassSoon } from '../../utils/classSoon';

function mapNotification(n, idx) {
  const raw = String(n?.type || 'info');
  let type = 'info';
  if (raw === 'success' || raw === 'asistencia') type = 'success';
  else if (raw === 'warning' || raw === 'retardo' || raw === 'not_recognized_photo') type = 'warning';
  else if (raw === 'attendance' || raw === 'inasistencia') type = 'attendance';
  else if (raw === 'reminder') type = 'reminder';
  const fallbackTitle = {
    success: 'Asistencia registrada',
    warning: raw === 'not_recognized_photo' ? 'No reconocido por foto' : 'Aviso',
    attendance: 'Inasistencia',
    info: 'Clase por comenzar',
  }[type];
  return {
    id: String(n?.id || idx),
    title: String(n?.title || fallbackTitle || 'Notificación'),
    message: String(n?.message || ''),
    type,
    time: formatActionDateTime(n?.createdAt || n?.markedAt || n?.time, String(n?.time || 'Hoy')),
    read: Boolean(n?.read),
    classId: n?.classId ? String(n.classId) : '',
  };
}

export default function Notifications({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { inAppNotifications } = useAppTheme();
  const { authToken, email, fullName, program, semester, phone, setNotificationUnread } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [classSoon, setClassSoon] = useState([]);
  const classSoonIdsRef = useRef([]);
  const locallyReadRef = useRef(new Set());

  useEffect(() => {
    if (!authToken || !STUDENT_NOTIFICATIONS_URL) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    const load = async ({ silent } = {}) => {
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
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
        if (!resp.ok) {
          const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
          throw new Error(msg);
        }
        const arr = Array.isArray(json?.notifications) ? json.notifications : [];
        if (!cancelled) {
          const mapped = arr.map(mapNotification).map((n) => (
            locallyReadRef.current.has(n.id) ? { ...n, read: true } : n
          ));
          setNotifications(mapped);
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
    load();
    (async () => {
      const list = await loadReminders(email);
      const soon = await loadClassSoon(email);
      if (!cancelled) {
        setReminders(list);
        setClassSoon(Array.isArray(soon.alerts) ? soon.alerts : []);
        classSoonIdsRef.current = Array.isArray(soon.notificationIds) ? soon.notificationIds : [];
      }
    })();
    const timer = setInterval(async () => {
      load({ silent: true });
      const soon = await loadClassSoon(email);
      if (!cancelled) {
        setClassSoon(Array.isArray(soon.alerts) ? soon.alerts : []);
        classSoonIdsRef.current = Array.isArray(soon.notificationIds) ? soon.notificationIds : [];
      }
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authToken, email]);

  const profileNotice = useMemo(() => {
    const profile = { fullName, program, semester, phone };
    if (isStudentProfileComplete(profile)) return null;
    return {
      id: 'local-complete-profile',
      title: 'Completa tu perfil',
      message: studentProfileIncompleteMessage(profile),
      type: 'warning',
      time: 'Ahora',
      read: false,
      local: true,
    };
  }, [fullName, program, semester, phone]);

  const reminderNotices = useMemo(() => reminders.filter(reminderIsDue).map((r) => {
    const dates = reminderDates(r);
    const whenLabel = dates.length ? `${dates.join(', ')} · ${r.time || ''}` : String(r.time || '');
    return {
      id: `reminder:${r.id}`,
      title: r.title || 'Recordatorio',
      message: r.description ? `${r.description} · ${whenLabel}` : whenLabel,
      type: 'reminder',
      time: whenLabel,
      read: Boolean(r.read),
      local: true,
      reminderId: r.id,
    };
  }), [reminders]);

  const classSoonNotices = useMemo(() => classSoon.filter(classSoonIsDue).map((a) => ({
    id: a.id,
    title: 'Clase por comenzar',
    message: `${a.className} empieza a las ${a.time}. Faltan 5 minutos.`,
    type: 'info',
    time: a.time,
    read: Boolean(a.read),
    local: true,
    classId: a.classId,
  })), [classSoon]);

  const displayedNotifications = useMemo(() => {
    if (!inAppNotifications) return [];
    const extra = [];
    if (profileNotice) extra.push(profileNotice);
    extra.push(...reminderNotices);
    extra.push(...classSoonNotices);
    const ids = new Set(extra.map((n) => n.id));
    const soonClassIds = new Set(classSoonNotices.map((n) => String(n.classId || '')));
    return [
      ...extra,
      ...notifications.filter((n) => {
        if (ids.has(n.id)) return false;
        const sid = String(n.id || '').toLowerCase();
        if (sid.includes('soon#') && soonClassIds.has(String(n.classId || ''))) return false;
        return true;
      }),
    ];
  }, [inAppNotifications, profileNotice, reminderNotices, classSoonNotices, notifications]);

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
    const reminderUnread = reminders.filter((n) => reminderIsDue(n) && !n.read).length;
    const classSoonUnread = classSoon.filter((a) => classSoonIsDue(a) && !a.read).length;
    setNotificationUnread(serverUnread + reminderUnread + classSoonUnread);
  }, [inAppNotifications, notifications, reminders, classSoon, setNotificationUnread]);

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

  const markAllAsRead = () => {
    notifications.forEach((n) => locallyReadRef.current.add(n.id));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const nextReminders = reminders.map((r) => ({ ...r, read: true }));
    setReminders(nextReminders);
    saveReminders(email, nextReminders);
    const nextSoon = classSoon.map((a) => ({ ...a, read: true }));
    setClassSoon(nextSoon);
    saveClassSoon(email, { alerts: nextSoon, notificationIds: classSoonIdsRef.current });
    persistRead({ all: true });
  };

  const markOneRead = (id) => {
    if (id === 'local-complete-profile') {
      navigation.navigate('StudentProfile', { forceEdit: true });
      return;
    }
    if (String(id).startsWith('reminder:')) {
      const rid = String(id).slice('reminder:'.length);
      const nextReminders = reminders.map((r) => (r.id === rid ? { ...r, read: true } : r));
      setReminders(nextReminders);
      saveReminders(email, nextReminders);
      navigation.navigate('StudentReminders');
      return;
    }
    if (String(id).startsWith('classsoon:')) {
      const nextSoon = classSoon.map((a) => (a.id === id ? { ...a, read: true } : a));
      setClassSoon(nextSoon);
      saveClassSoon(email, { alerts: nextSoon, notificationIds: classSoonIdsRef.current });
      return;
    }
    locallyReadRef.current.add(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    persistRead({ ids: [id] });
  };

  const deleteNotification = (id) => {
    if (id === 'local-complete-profile') {
      navigation.navigate('StudentProfile', { forceEdit: true });
      return;
    }
    if (String(id).startsWith('reminder:')) {
      const rid = String(id).slice('reminder:'.length);
      const nextReminders = reminders.map((r) => (r.id === rid ? { ...r, read: true } : r));
      setReminders(nextReminders);
      saveReminders(email, nextReminders);
      return;
    }
    if (String(id).startsWith('classsoon:')) {
      const nextSoon = classSoon.filter((a) => a.id !== id);
      setClassSoon(nextSoon);
      saveClassSoon(email, { alerts: nextSoon, notificationIds: classSoonIdsRef.current });
      return;
    }
    locallyReadRef.current.add(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    persistRead({ ids: [id] });
  };

  const getConfig = (type) => {
    switch (type) {
      case 'reminder':
        return { Icon: Bell, bg: COLORS.reminderSoft, border: COLORS.reminderBorder, iconBg: COLORS.reminder };
      case 'success':
        return { Icon: CheckCheck, bg: COLORS.successSoft, border: COLORS.successBorder, iconBg: COLORS.successStrong };
      case 'warning':
        return { Icon: AlertTriangle, bg: COLORS.warningSoft, border: COLORS.warningBorder, iconBg: COLORS.warningStrong };
      case 'attendance':
        return { Icon: Clock, bg: COLORS.dangerSoft, border: COLORS.dangerBorder, iconBg: COLORS.dangerStrong };
      default:
        return { Icon: Info, bg: COLORS.infoSoft, border: COLORS.infoBorder, iconBg: COLORS.infoStrong };
    }
  };

  const renderItem = (n, idx) => {
    const cfg = getConfig(n.type);
    return (
      <Animated.View key={n.id} entering={listEnter(idx)}>
      <Pressable
        onPress={() => { if (!n.read) markOneRead(n.id); }}
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
            <Text style={[styles.itemTitle, { color: n.read ? COLORS.textSecondary : COLORS.text }]}>{n.title}</Text>
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
              <Bell size={40} color={COLORS.placeholder} />
            </View>
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptyText}>No tienes notificaciones pendientes</Text>
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
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: COLORS.textSecondary },
  emptyText: { marginTop: 6, color: COLORS.muted },
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
