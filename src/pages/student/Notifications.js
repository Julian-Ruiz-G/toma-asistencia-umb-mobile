import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { STUDENT_NOTIFICATIONS_URL } from '../../config';
import { useAuth } from '../../state/auth';

export default function Notifications({ navigation }) {
  const { authToken } = useAuth();
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      title: 'Asistencia Registrada',
      message: 'Tu asistencia a Cálculo Diferencial fue registrada exitosamente.',
      type: 'success',
      time: 'Hace 5 minutos',
      read: false,
    },
    {
      id: '2',
      title: 'Retardo Detectado',
      message: 'Llegaste tarde a Física I. Tu asistencia fue marcada como retardo.',
      type: 'warning',
      time: 'Hace 2 horas',
      read: false,
    },
    {
      id: '3',
      title: 'Recordatorio de Clase',
      message: 'Tienes Programación en 30 minutos. Aula 204.',
      type: 'info',
      time: 'Hace 3 horas',
      read: true,
    },
    {
      id: '4',
      title: 'Falta Registrada',
      message: 'No se registró tu asistencia en Base de Datos del 01/04.',
      type: 'attendance',
      time: 'Hace 2 días',
      read: true,
    },
  ]);

  useEffect(() => {
    (async () => {
      try {
        if (!authToken) return;
        if (!STUDENT_NOTIFICATIONS_URL) return;

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
        if (!resp.ok) {
          const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
          throw new Error(msg);
        }

        const arr = Array.isArray(json?.notifications) ? json.notifications : [];
        const mapped = arr.map((n) => {
          const type = n?.type === 'not_recognized_photo' ? 'warning' : 'info';
          return {
            id: String(n?.id || ''),
            title: 'No reconocido por foto',
            message: String(n?.message || ''),
            type,
            time: 'Hoy',
            read: false,
          };
        });
        setNotifications(mapped);
      } catch (e) {
        Alert.alert('Error', e?.message || String(e));
      }
    })();
  }, [authToken]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
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

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          <Text style={styles.headerSubtitle}>{unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}</Text>
        </View>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllAsRead} style={styles.headerAction}>
            <Text style={styles.headerActionText}>Marcar todas</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {notifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Bell size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptyText}>No tienes notificaciones pendientes</Text>
          </View>
        ) : (
          notifications.map((n) => {
            const cfg = getConfig(n.type);
            return (
              <View
                key={n.id}
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
              </View>
            );
          })
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
