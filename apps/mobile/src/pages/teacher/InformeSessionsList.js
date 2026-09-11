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
import { ArrowLeft, Calendar, ChevronRight, FileSpreadsheet } from 'lucide-react-native';

import { COLORS } from '../../ui/theme';
import { useAuth } from '../../state/auth';
import { CLASS_DETAILS_URL } from '../../config';

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

  const formatSessionDate = (d) => {
    const s = String(d || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '—';
    try {
      const [y, m, day] = s.split('-').map(Number);
      const dt = new Date(y, m - 1, day);
      return dt.toLocaleDateString('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return s;
    }
  };

  const renderItem = ({ item }) => (
    <Pressable
      onPress={() =>
        navigation.navigate('ReportPreview', {
          sessionId: item.sessionId,
          classId,
          classMeta,
        })
      }
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <Calendar size={20} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{formatSessionDate(item.sessionDate)}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.sessionId}
          {item.corte ? ` • Corte ${item.corte}` : ''}
        </Text>
      </View>
      <ChevronRight size={20} color="#9CA3AF" />
    </Pressable>
  );

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
          </Text>
          <Text style={styles.orderHint}>Más recientes arriba</Text>
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
  listPad: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  emptyList: { flexGrow: 1, padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  rowPressed: { opacity: 0.92, backgroundColor: '#F9FAFB' },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(185,28,28,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontWeight: '800', color: '#111827', textTransform: 'capitalize' },
  rowSub: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  emptyBox: { paddingVertical: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: '#374151', textAlign: 'center' },
  emptyText: { marginTop: 10, fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
