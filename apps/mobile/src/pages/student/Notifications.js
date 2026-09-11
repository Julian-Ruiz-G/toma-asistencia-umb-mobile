import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { STUDENT_NOTIFICATIONS_URL, MARK_NOTIFICATIONS_READ_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { formatActionDateTime } from '../../utils/formatDateTime';
import { isStudentProfileComplete, studentProfileIncompleteMessage } from '../../utils/studentProfile';

function mapNotification(n, idx) {
  const raw = String(n?.type || 'info');
  let type = 'info';
  if (raw === 'success' || raw === 'asistencia') type = 'success';
  else if (raw === 'warning' || raw === 'retardo' || raw === 'not_recognized_photo') type = 'warning';
  else if (raw === 'attendance' || raw === 'inasistencia') type = 'attendance';
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
  };
}

export default function Notifications({ navigation }) {
  const { authToken, fullName, program, semester, phone } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

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
        if (!cancelled) setNotifications(arr.map(mapNotification));
      } catch (e) {
        if (!silent && !cancelled) {
          Alert.alert('Error', e?.message || String(e));
          setNotifications([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = setInterval(() => load({ silent: true }), 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authToken]);

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

  const displayedNotifications = useMemo(() => {
    if (!profileNotice) return notifications;
    return [profileNotice, ...notifications.filter((n) => n.id !== profileNotice.id)];
  }, [profileNotice, notifications]);

  const unreadCount = useMemo(
    () => displayedNotifications.filter((n) => !n.read).length,
    [displayedNotifications]
  );

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
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    persistRead({ all: true });
  };

  const markOneRead = (id) => {
    if (id === 'local-complete-profile') {
      navigation.navigate('StudentProfile', { forceEdit: true });
      return;
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    persistRead({ ids: [id] });
  };

  const deleteNotification = (id) => {
    if (id === 'local-complete-profile') {
      navigation.navigate('StudentProfile', { forceEdit: true });
      return;
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    persistRead({ ids: [id] });
  };

  const getConfig = (type) => {
    switch (type) {
      case 'success':
        return { Icon: CheckCheck, bg: '#ECFDF5', border: '#BBF7D0', iconBg: '#22C55E' };
      case 'warning':
        return { Icon: AlertTriangle, bg: '#FFFBEB', border: '#FDE68A', iconBg: '#EAB308' };
      case 'attendance':
        return { Icon: Clock, bg: '#FEF2F2', border: '#FECACA', iconBg: '#EF4444' };
      default:
        return { Icon: Info, bg: '#EFF6FF', border: '#BFDBFE', iconBg: '#3B82F6' };
    }
  };

  const renderItem = (n) => {
    const cfg = getConfig(n.type);
    return (
      <Pressable
        key={n.id}
        onPress={() => { if (!n.read) markOneRead(n.id); }}
        style={[
          styles.item,
          { borderColor: n.read ? '#F3F4F6' : cfg.border, backgroundColor: n.read ? '#fff' : cfg.bg },
        ]}
      >
        <View style={[styles.itemIconWrap, { backgroundColor: cfg.iconBg }]}>
          <cfg.Icon size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.itemTopRow}>
            <Text style={[styles.itemTitle, { color: n.read ? '#374151' : '#111827' }]}>{n.title}</Text>
            {!n.read ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={[styles.itemMsg, { color: n.read ? '#6B7280' : '#374151' }]}>{n.message}</Text>
          <View style={styles.itemBottomRow}>
            <Text style={styles.itemTime}>{n.time}</Text>
            <Pressable onPress={() => deleteNotification(n.id)} style={styles.trashBtn}>
              <Trash2 size={18} color="#9CA3AF" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
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
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.emptyText}>Cargando notificaciones...</Text>
          </View>
        ) : displayedNotifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Bell size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptyText}>No tienes notificaciones pendientes</Text>
          </View>
        ) : (
          displayedNotifications.map(renderItem)
        )}

        <View style={{ height: 12 }} />
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: '#6B7280' },
  headerAction: { paddingVertical: 8, paddingHorizontal: 10 },
  headerActionText: { color: COLORS.primary, fontWeight: '800' },
  body: { paddingHorizontal: 24, paddingVertical: 18, paddingBottom: 28 },
  emptyWrap: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: '#374151' },
  emptyText: { marginTop: 6, color: '#6B7280' },
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#fff',
    shadowColor: '#000',
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
  itemTime: { fontSize: 12, color: '#9CA3AF' },
  trashBtn: { padding: 6, borderRadius: 10 },
});
