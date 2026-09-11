import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Calendar, RefreshCw } from 'lucide-react-native';
import { API_BASE, MY_CLASSES_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { COLORS } from '../../ui/theme';

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_LABEL = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
};

const dayToIndex = (day) => {
  const d = String(day || '').toUpperCase();
  const i = DAY_ORDER.indexOf(d);
  return i < 0 ? 999 : i;
};

export default function ScheduleScreen({ navigation }) {
  const { authToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [activeDay, setActiveDay] = useState('MONDAY');

  const STUDENT_MY_CLASSES_URL = API_BASE ? `${API_BASE}/my-classes-student` : '';

  const load = async () => {
    if (!API_BASE) {
      Alert.alert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }
    if (!authToken) {
      Alert.alert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return;
    }

    const tryFetch = async (url) => {
      const resp = await fetch(url, {
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
      return { resp, json, text };
    };

    setLoading(true);
    try {
      // Prefer student endpoint if exists; fallback to /my-classes.
      let r = null;
      if (STUDENT_MY_CLASSES_URL) {
        r = await tryFetch(STUDENT_MY_CLASSES_URL);
      }
      if (!r || !r.resp.ok) {
        if (!MY_CLASSES_URL) throw new Error('Endpoint de clases no configurado');
        r = await tryFetch(MY_CLASSES_URL);
      }

      if (!r.resp.ok) {
        const msg = (r.json && (r.json.error || r.json.message || r.json.details)) || r.text || `HTTP ${r.resp.status}`;
        throw new Error(msg);
      }

      const list = Array.isArray(r.json?.classes) ? r.json.classes : [];
      setClasses(list);
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = useMemo(() => {
    const out = [];
    for (const c of classes) {
      const sched = Array.isArray(c?.schedule) ? c.schedule : [];
      for (const s of sched) {
        const day = String(s?.day || '').toUpperCase();
        if (!day) continue;
        out.push({
          day,
          startTime: String(s?.startTime || ''),
          endTime: String(s?.endTime || ''),
          className: String(c?.className || c?.subject || 'Clase'),
          group: String(c?.group || ''),
          room: String(c?.room || c?.classroom || ''),
          teacher: String(c?.teacher || c?.professor || ''),
          classId: c?.classId,
        });
      }
    }

    out.sort((a, b) => {
      const di = dayToIndex(a.day) - dayToIndex(b.day);
      if (di !== 0) return di;
      return String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99'));
    });

    return out;
  }, [classes]);

  const perDay = useMemo(() => {
    const map = {};
    for (const d of DAY_ORDER) map[d] = [];
    for (const e of entries) {
      if (!map[e.day]) map[e.day] = [];
      map[e.day].push(e);
    }
    return map;
  }, [entries]);

  const dayList = useMemo(() => DAY_ORDER.map((d) => ({ key: d, label: DAY_LABEL[d] || d })), []);
  const activeList = perDay[activeDay] || [];

  const timeBg = (t) => {
    const hh = parseInt(String(t || '').split(':')[0] || '0', 10);
    if (!Number.isFinite(hh)) return 'rgba(185,28,28,0.10)';
    if (hh < 10) return 'rgba(185,28,28,0.10)';
    if (hh < 13) return 'rgba(30,64,175,0.10)';
    return 'rgba(34,197,94,0.12)';
  };
  const timeColor = (t) => {
    const hh = parseInt(String(t || '').split(':')[0] || '0', 10);
    if (!Number.isFinite(hh)) return COLORS.primary;
    if (hh < 10) return COLORS.primary;
    if (hh < 13) return COLORS.blue;
    return '#16A34A';
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Horario de Clases</Text>
          <Text style={styles.headerSubtitle}>Semana</Text>
        </View>
        <Pressable onPress={load} style={styles.iconBtn}>
          <RefreshCw size={20} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Calendar size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Tu horario</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPills}>
            {dayList.map((d) => {
              const active = activeDay === d.key;
              return (
                <Pressable
                  key={d.key}
                  onPress={() => setActiveDay(d.key)}
                  style={[styles.dayPill, active ? styles.dayPillActive : null]}
                >
                  <Text style={[styles.dayPillText, active ? styles.dayPillTextActive : null]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ height: 12 }} />

          {activeList.map((it, idx) => (
            <View key={`${it.day}-${it.startTime}-${idx}`} style={styles.itemRow}>
              <View style={[styles.timeBox, { backgroundColor: timeBg(it.startTime) }]}>
                <Text style={[styles.timeText, { color: timeColor(it.startTime) }]}>{it.startTime || '--:--'}</Text>
              </View>
              <View style={styles.itemCard}>
                <Text style={styles.itemTitle}>{it.className}</Text>
                <Text style={styles.itemSub}>
                  {it.room ? `Aula ${it.room}` : 'Aula'}
                  {it.teacher ? ` • ${it.teacher}` : ''}
                </Text>
                <Text style={styles.itemMeta}>
                  {it.endTime ? `${it.startTime}-${it.endTime}` : it.startTime}
                  {it.group ? ` • ${it.group}` : ''}
                </Text>
              </View>
            </View>
          ))}

          {activeList.length === 0 && !loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Sin clases</Text>
              <Text style={styles.emptyText}>No tienes clases programadas para este día.</Text>
            </View>
          ) : null}

          {loading ? <Text style={styles.muted}>Cargando...</Text> : null}
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
  body: { paddingHorizontal: 24, paddingVertical: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontWeight: '800', color: '#1F2937' },
  dayPills: { gap: 10, paddingTop: 12, paddingBottom: 2 },
  dayPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  dayPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayPillText: { color: '#6B7280', fontWeight: '800' },
  dayPillTextActive: { color: '#fff' },
  itemRow: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'stretch' },
  timeBox: { width: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  timeText: { fontWeight: '900' },
  itemCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  itemTitle: { fontWeight: '900', color: '#111827' },
  itemSub: { marginTop: 3, color: '#6B7280' },
  itemMeta: { marginTop: 8, color: '#9CA3AF', fontSize: 12 },
  emptyWrap: { marginTop: 10, alignItems: 'center', paddingVertical: 18 },
  emptyTitle: { fontWeight: '900', color: '#111827' },
  emptyText: { marginTop: 6, color: '#6B7280', textAlign: 'center' },
  muted: { marginTop: 10, color: '#6B7280' },
});
