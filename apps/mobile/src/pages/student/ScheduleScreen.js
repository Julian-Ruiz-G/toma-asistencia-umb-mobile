import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Bell, Calendar, Clock, MapPin, RefreshCw, Users } from 'lucide-react-native';
import { API_BASE, MY_CLASSES_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { COLORS } from '../../ui/theme';
import Animated, { enterDown, listEnter } from '../../ui/motion';
import { dateToDayKey, loadReminders, reminderDates } from '../../utils/remindersStore';
import { todayScheduleKey } from '../../utils/schedule';

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_LABEL = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};
const DAY_SHORT = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

const dayToIndex = (day) => {
  const d = String(day || '').toUpperCase();
  const i = DAY_ORDER.indexOf(d);
  return i < 0 ? 999 : i;
};

function todayKey() {
  return todayScheduleKey();
}

function accentForTime(t) {
  const hh = parseInt(String(t || '').split(':')[0] || '0', 10);
  if (!Number.isFinite(hh) || hh < 10) return COLORS.primary;
  if (hh < 13) return COLORS.blue;
  return '#16A34A';
}

export default function ScheduleScreen({ navigation }) {
  const { authToken, email } = useAuth();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [activeDay, setActiveDay] = useState(todayKey);

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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const list = await loadReminders(email);
        if (!cancelled) setReminders(list);
      })();
      return () => {
        cancelled = true;
      };
    }, [email])
  );

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

  const reminderEntries = useMemo(() => reminders.flatMap((r) => (
    reminderDates(r).map((date) => ({
      kind: 'reminder',
      day: dateToDayKey(date),
      startTime: String(r.time || ''),
      endTime: '',
      className: String(r.title || 'Recordatorio'),
      group: '',
      room: '',
      teacher: String(r.description || ''),
      classId: `${r.id}:${date}`,
    }))
  )), [reminders]);

  const perDay = useMemo(() => {
    const map = {};
    for (const d of DAY_ORDER) map[d] = [];
    for (const e of entries) {
      if (!map[e.day]) map[e.day] = [];
      map[e.day].push({ ...e, kind: 'class' });
    }
    for (const e of reminderEntries) {
      if (!e.day) continue;
      if (!map[e.day]) map[e.day] = [];
      map[e.day].push(e);
    }
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99')));
    });
    return map;
  }, [entries, reminderEntries]);

  const dayList = useMemo(() => DAY_ORDER.map((d) => ({
    key: d,
    label: DAY_LABEL[d] || d,
    short: DAY_SHORT[d] || d,
    count: (perDay[d] || []).length,
  })), [perDay]);
  const activeList = perDay[activeDay] || [];
  const isToday = activeDay === todayKey();

  return (
    <View style={styles.root}>
      <Animated.View entering={enterDown(0, 360)} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Horario</Text>
          <Text style={styles.headerSubtitle}>
            {DAY_LABEL[activeDay]}
            {isToday ? ' · Hoy' : ''}
            {activeList.length ? ` · ${activeList.length} ${activeList.length === 1 ? 'evento' : 'eventos'}` : ''}
          </Text>
        </View>
        <Pressable onPress={load} style={styles.iconBtn}>
          <RefreshCw size={20} color="#4B5563" />
        </Pressable>
      </Animated.View>

      <Animated.View entering={enterDown(60)} style={styles.weekBar}>
        {dayList.map((d) => {
          const active = activeDay === d.key;
          return (
            <Pressable
              key={d.key}
              onPress={() => setActiveDay(d.key)}
              style={[styles.dayCol, active ? styles.dayColActive : null]}
            >
              <Text style={[styles.dayShort, active ? styles.dayShortActive : null]}>{d.short}</Text>
              <View style={[styles.dayDot, d.count ? (active ? styles.dayDotActive : styles.dayDotHas) : null]} />
            </Pressable>
          );
        })}
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? <Text style={styles.muted}>Cargando horario…</Text> : null}

        {!loading && activeList.length === 0 ? (
          <Animated.View entering={enterDown(80)} style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Calendar size={28} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>Día libre</Text>
            <Text style={styles.emptyText}>No tienes clases ni recordatorios este día.</Text>
          </Animated.View>
        ) : null}

        {activeList.map((it, idx) => {
          const isReminder = it.kind === 'reminder';
          const accent = isReminder ? '#7C3AED' : accentForTime(it.startTime);
          return (
            <Animated.View
              key={`${it.kind}-${it.day}-${it.startTime}-${it.classId || idx}`}
              entering={listEnter(idx)}
              style={styles.classCard}
            >
              <View style={[styles.accent, { backgroundColor: accent }]} />
              <View style={styles.timeCol}>
                <Text style={[styles.timeStart, { color: accent }]}>{it.startTime || '--:--'}</Text>
                <View style={[styles.timeLine, { backgroundColor: accent }]} />
                <Text style={styles.timeEnd}>{isReminder ? 'Aviso' : (it.endTime || '--:--')}</Text>
              </View>
              <View style={styles.classBody}>
                {isReminder ? (
                  <View style={styles.reminderTag}>
                    <Bell size={11} color="#7C3AED" />
                    <Text style={styles.reminderTagText}>Recordatorio</Text>
                  </View>
                ) : null}
                <Text style={styles.className}>{it.className}</Text>
                {it.teacher ? (
                  <Text style={styles.teacher} numberOfLines={2}>{it.teacher}</Text>
                ) : null}
                {!isReminder ? (
                <View style={styles.chips}>
                  {it.room ? (
                    <View style={styles.chip}>
                      <MapPin size={12} color="#6B7280" />
                      <Text style={styles.chipText}>Aula {it.room}</Text>
                    </View>
                  ) : null}
                  {it.group ? (
                    <View style={styles.chip}>
                      <Users size={12} color="#6B7280" />
                      <Text style={styles.chipText}>{it.group}</Text>
                    </View>
                  ) : null}
                  {!it.room && !it.group ? (
                    <View style={styles.chip}>
                      <Clock size={12} color="#6B7280" />
                      <Text style={styles.chipText}>
                        {it.endTime ? `${it.startTime} – ${it.endTime}` : it.startTime}
                      </Text>
                    </View>
                  ) : null}
                </View>
                ) : null}
              </View>
            </Animated.View>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 12, borderRadius: 999 },
  iconBtn: { padding: 10, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: '#6B7280' },
  weekBar: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
  },
  dayColActive: { backgroundColor: COLORS.primary },
  dayShort: { fontWeight: '800', fontSize: 11, color: '#6B7280' },
  dayShortActive: { color: '#fff' },
  dayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 6, backgroundColor: 'transparent' },
  dayDotHas: { backgroundColor: COLORS.primary },
  dayDotActive: { backgroundColor: '#fff' },
  body: { paddingHorizontal: 20, paddingTop: 18 },
  classCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    minHeight: 108,
  },
  accent: { width: 5 },
  timeCol: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#FAFAFA',
  },
  timeStart: { fontWeight: '900', fontSize: 14 },
  timeLine: { width: 1.5, height: 14, marginVertical: 6, opacity: 0.45 },
  timeEnd: { fontWeight: '700', fontSize: 12, color: '#9CA3AF' },
  classBody: { flex: 1, paddingVertical: 16, paddingHorizontal: 14, justifyContent: 'center' },
  className: { fontWeight: '900', fontSize: 16, color: '#111827', lineHeight: 22 },
  reminderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  reminderTagText: { fontSize: 11, fontWeight: '800', color: '#7C3AED' },
  teacher: { marginTop: 4, color: '#6B7280', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, color: '#4B5563', fontWeight: '700' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  emptyText: { marginTop: 6, color: '#6B7280', textAlign: 'center' },
  muted: { color: '#6B7280', textAlign: 'center', marginBottom: 12 },
});
