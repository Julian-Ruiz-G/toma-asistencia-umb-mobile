import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Calendar, ChevronRight, Clock, FileSpreadsheet, Layers } from 'lucide-react-native';

import { COLORS } from '../../ui/theme';
import { useAuth } from '../../state/auth';
import { CLASS_DETAILS_URL } from '../../config';
import { colombiaDateLongFromYmd, colombiaWeekdayLongFromYmd } from '../../utils/formatDateTime';
import { resolveSessionYmd } from '../../utils/schedule';

function sortSessionsNewestFirst(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => {
    const da = String(a?.sessionDate || '');
    const db = String(b?.sessionDate || '');
    if (db !== da) return db.localeCompare(da);
    const ea = parseInt(String(a?.scheduledStartEpoch || '0'), 10) || 0;
    const eb = parseInt(String(b?.scheduledStartEpoch || '0'), 10) || 0;
    if (eb !== ea) return eb - ea;
    return String(b?.sessionId || '').localeCompare(String(a?.sessionId || ''));
  });
  return list;
}

export default function InformeSessionsList({ navigation, route }) {
  const { authToken } = useAuth();
  const { classId, className, group, room } = route.params || {};

  const [sessions, setSessions] = useState([]);
  const [classSchedule, setClassSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const classMeta = useMemo(
    () => ({ title: className || 'Clase', group: group || '', room: room || '' }),
    [className, group, room]
  );

  const load = useCallback(async () => {
    if (!CLASS_DETAILS_URL || !classId || !authToken) {
      setError(!authToken ? 'Sesión no válida' : 'Falta configuración de API o clase');
      setSessions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError('');
    try {
      const resp = await fetch(CLASS_DETAILS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
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
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      const raw = Array.isArray(json?.attendanceSessions) ? json.attendanceSessions : [];
      setClassSchedule(Array.isArray(json?.class?.schedule) ? json.class.schedule : []);
      setSessions(sortSessionsNewestFirst(raw));
    } catch (e) {
      setError(e?.message || String(e));
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken, classId]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const formatSessionDate = (item) => {
    const ymd = resolveSessionYmd({
      sessionDate: item?.sessionDate,
      sessionId: item?.sessionId,
      scheduledStartEpoch: item?.scheduledStartEpoch,
      schedule: classSchedule,
    });
    if (!ymd) return { title: String(item?.sessionDate || item?.sessionId || '—'), weekday: '', ymd: '' };
    return {
      weekday: colombiaWeekdayLongFromYmd(ymd),
      title: colombiaDateLongFromYmd(ymd),
      ymd,
    };
  };

  const renderItem = ({ item, index }) => {
    const d = formatSessionDate(item);
    return (
      <Pressable
        onPress={() =>
          navigation.navigate('ReportPreview', {
            sessionId: item.sessionId,
            classId,
            classMeta,
          })
        }
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardTop}>
          <View style={styles.rowIcon}>
            <Calendar size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            {d.weekday ? <Text style={styles.weekday}>{d.weekday}</Text> : null}
            <Text style={styles.rowTitle}>{d.title}</Text>
          </View>
          {item.corte ? (
            <View style={styles.cortePill}>
              <Layers size={12} color={COLORS.primary} />
              <Text style={styles.corteText}>Corte {item.corte}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Clock size={13} color="#9CA3AF" />
          <Text style={styles.rowSub}>Sesión {index + 1} de {sessions.length}</Text>
        </View>
        <Text style={styles.idText} numberOfLines={2}>{item.sessionId}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.openText}>Abrir informe</Text>
          <ChevronRight size={18} color={COLORS.primary} />
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
          <View style={styles.titleRow}>
            <FileSpreadsheet size={20} color="#16A34A" />
            <Text style={styles.headerTitle}>Informe por sesión</Text>
          </View>
          <Text style={styles.headerSub} numberOfLines={2}>
            {className || 'Clase'}
            {group ? ` • Grupo ${group}` : ''}
            {room ? ` • ${room}` : ''}
          </Text>
          <Text style={styles.orderHint}>
            {sessions.length ? `${sessions.length} sesión${sessions.length === 1 ? '' : 'es'} · más recientes arriba` : 'Más recientes arriba'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>Cargando sesiones…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
          <Pressable onPress={() => { setLoading(true); load(); }} style={styles.retry}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.sessionId)}
          renderItem={renderItem}
          contentContainerStyle={sessions.length === 0 ? styles.emptyList : styles.listPad}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Calendar size={28} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>No hay sesiones registradas</Text>
              <Text style={styles.emptyText}>
                Cuando generes QR de asistencia y se cree una sesión, aparecerá aquí. Arriba verás siempre la más
                nueva.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: '#fff',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 10, borderRadius: 999 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  headerSub: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  orderHint: { marginTop: 6, fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { marginTop: 10, color: '#6B7280' },
  err: { color: '#B91C1C', textAlign: 'center', fontWeight: '700' },
  retry: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: COLORS.primary, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '800' },
  listPad: { paddingHorizontal: 16, paddingBottom: 28, paddingTop: 12 },
  emptyList: { flexGrow: 1, padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardPressed: { opacity: 0.94, backgroundColor: '#F9FAFB' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(185,28,28,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  rowTitle: { marginTop: 2, fontWeight: '900', color: '#111827', fontSize: 16, textTransform: 'capitalize' },
  cortePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(185,28,28,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  corteText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  rowSub: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  idText: { marginTop: 6, fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openText: { fontWeight: '800', color: COLORS.primary, fontSize: 13 },
  emptyBox: { paddingVertical: 40, alignItems: 'center' },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: '#374151', textAlign: 'center' },
  emptyText: { marginTop: 10, fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
