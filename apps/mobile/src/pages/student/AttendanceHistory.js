import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Filter,
  User,
  X,
  XCircle,
} from 'lucide-react-native';
import { COLORS } from '../../ui/theme';
import Animated, { enterDown, listEnter } from '../../ui/motion';
import { STUDENT_ATTENDANCE_HISTORY_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { formatActionDateTime } from '../../utils/formatDateTime';

export default function AttendanceHistory({ navigation, route }) {
  const { authToken } = useAuth();
  const initialFilter = String(route?.params?.filter || 'all');
  const [filter, setFilter] = useState(initialFilter);
  const [showFilter, setShowFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const next = String(route?.params?.filter || 'all');
    if (next === 'all' || next === 'present' || next === 'late' || next === 'absent') {
      setFilter(next);
    }
  }, [route?.params?.filter]);

  useEffect(() => {
    (async () => {
      try {
        if (!authToken || !STUDENT_ATTENDANCE_HISTORY_URL) {
          setAttendanceData([]);
          return;
        }
        setLoading(true);
        const resp = await fetch(STUDENT_ATTENDANCE_HISTORY_URL, {
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
        const arr = Array.isArray(json?.records) ? json.records : [];
        setAttendanceData(arr.map((r, idx) => ({
          id: String(r?.id || `${r?.sessionId || idx}`),
          date: String(r?.date || r?.dateRaw || '—'),
          dateRaw: String(r?.dateRaw || ''),
          subject: String(r?.subject || 'Clase'),
          professor: String(r?.professor || 'Docente'),
          time: String(r?.time || '—'),
          status: String(r?.status || 'absent'),
          sessionId: String(r?.sessionId || ''),
          classId: String(r?.classId || ''),
          markedAt: r?.markedAt ?? null,
        })));
      } catch (e) {
        appAlert('Error', e?.message || String(e));
        setAttendanceData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [authToken]);

  const filtered = useMemo(() => attendanceData.filter(r => filter === 'all' || r.status === filter), [attendanceData, filter]);

  const stats = useMemo(() => {
    const present = attendanceData.filter(r => r.status === 'present').length;
    const late = attendanceData.filter(r => r.status === 'late').length;
    const absent = attendanceData.filter(r => r.status === 'absent').length;
    const total = attendanceData.length;
    return { present, late, absent, total };
  }, [attendanceData]);

  const percent = stats.total
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0;

  const toggleStatFilter = (value) => {
    setFilter((prev) => (prev === value ? 'all' : value));
    setShowFilter(false);
  };

  const statusCfg = (status) => {
    switch (status) {
      case 'present':
        return { label: 'Presente', Icon: CheckCircle, bg: '#ECFDF5', border: '#BBF7D0', text: '#15803D', icon: '#22C55E' };
      case 'late':
        return { label: 'Retardo', Icon: AlertCircle, bg: '#FFFBEB', border: '#FDE68A', text: '#A16207', icon: '#EAB308' };
      default:
        return { label: 'Ausente', Icon: XCircle, bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', icon: '#EF4444' };
    }
  };

  const filterOptions = [
    { value: 'all', label: 'Todas' },
    { value: 'present', label: 'Presentes' },
    { value: 'late', label: 'Retardos' },
    { value: 'absent', label: 'Ausencias' },
  ];

  return (
    <View style={styles.root}>
      <Animated.View entering={enterDown(0, 360)} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Historial</Text>
          <Text style={styles.headerSubtitle}>Registro de asistencias</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body}>
        <Animated.View entering={enterDown(70)} style={styles.statsRow}>
          <Pressable
            onPress={() => toggleStatFilter('present')}
            style={[styles.statMiniCard, filter === 'present' ? styles.statMiniCardActive : null]}
          >
            <View style={[styles.statIcon, { backgroundColor: '#DCFCE7' }]}>
              <CheckCircle size={20} color="#16A34A" />
            </View>
            <Text style={styles.statNumber}>{stats.present}</Text>
            <Text style={styles.statMiniLabel}>Presentes</Text>
          </Pressable>
          <Pressable
            onPress={() => toggleStatFilter('late')}
            style={[styles.statMiniCard, filter === 'late' ? styles.statMiniCardActive : null]}
          >
            <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
              <AlertCircle size={20} color="#A16207" />
            </View>
            <Text style={styles.statNumber}>{stats.late}</Text>
            <Text style={styles.statMiniLabel}>Retardos</Text>
          </Pressable>
          <Pressable
            onPress={() => toggleStatFilter('absent')}
            style={[styles.statMiniCard, filter === 'absent' ? styles.statMiniCardActive : null]}
          >
            <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
              <XCircle size={20} color="#B91C1C" />
            </View>
            <Text style={styles.statNumber}>{stats.absent}</Text>
            <Text style={styles.statMiniLabel}>Ausencias</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={enterDown(120)} style={styles.percentCard}>
          <View>
            <Text style={styles.percentSub}>Porcentaje de asistencia</Text>
            <Text style={styles.percentValue}>{percent}%</Text>
          </View>
          <View style={styles.percentIconWrap}>
            <BookOpen size={28} color="#fff" />
          </View>
        </Animated.View>

        <View style={{ height: 14 }} />

        <View>
          <Pressable onPress={() => setShowFilter(v => !v)} style={styles.filterBtn}>
            <View style={styles.filterLeft}>
              <Filter size={18} color="#6B7280" />
              <Text style={styles.filterText}>{filterOptions.find(o => o.value === filter)?.label}</Text>
            </View>
            <ChevronDown size={18} color="#6B7280" style={{ transform: [{ rotate: showFilter ? '180deg' : '0deg' }] }} />
          </Pressable>

          {showFilter ? (
            <View style={styles.dropdown}>
              {filterOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    setFilter(opt.value);
                    setShowFilter(false);
                  }}
                  style={[styles.dropdownItem, filter === opt.value ? styles.dropdownItemActive : null]}
                >
                  <Text style={[styles.dropdownText, filter === opt.value ? styles.dropdownTextActive : null]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ height: 14 }} />

        {loading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.emptyText}>Cargando historial...</Text>
          </View>
        ) : null}

        {!loading && filtered.map((r, idx) => {
          const cfg = statusCfg(r.status);
          return (
            <Pressable key={r.id} onPress={() => setSelected(r)}>
              <Animated.View entering={listEnter(idx)} style={[styles.recordCard, { borderColor: cfg.border }]}>
              <View style={[styles.recordIconWrap, { backgroundColor: cfg.bg }]}>
                <cfg.Icon size={22} color={cfg.icon} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.recordTopRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.recordSubject}>{r.subject}</Text>
                    <Text style={styles.recordProf}>{r.professor}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusPillText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                </View>
                <View style={styles.recordMetaRow}>
                  <View style={styles.metaItem}>
                    <Calendar size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{r.date}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{r.time}</Text>
                  </View>
                </View>
              </View>
              </Animated.View>
            </Pressable>
          );
        })}

        {!loading && filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Calendar size={32} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyText}>No hay registros para este filtro</Text>
          </View>
        ) : null}

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.detailOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          <View style={styles.detailCard}>
            {selected ? (
              <>
                <View style={styles.detailHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.detailKicker}>Detalle de asistencia</Text>
                    <Text style={styles.detailTitle}>{selected.subject}</Text>
                  </View>
                  <Pressable onPress={() => setSelected(null)} style={styles.detailClose} hitSlop={8}>
                    <X size={18} color="#6B7280" />
                  </Pressable>
                </View>
                {(() => {
                  const cfg = statusCfg(selected.status);
                  return (
                    <View style={[styles.detailStatus, { backgroundColor: cfg.bg }]}>
                      <cfg.Icon size={18} color={cfg.icon} />
                      <Text style={[styles.detailStatusText, { color: cfg.text }]}>{cfg.label}</Text>
                    </View>
                  );
                })()}
                <View style={styles.detailRow}>
                  <User size={16} color="#6B7280" />
                  <View>
                    <Text style={styles.detailLabel}>Docente</Text>
                    <Text style={styles.detailValue}>{selected.professor || '—'}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Calendar size={16} color="#6B7280" />
                  <View>
                    <Text style={styles.detailLabel}>Fecha de la sesión</Text>
                    <Text style={styles.detailValue}>{selected.date || '—'}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Clock size={16} color="#6B7280" />
                  <View>
                    <Text style={styles.detailLabel}>Hora de la clase</Text>
                    <Text style={styles.detailValue}>{selected.time || '—'}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <CheckCircle size={16} color="#6B7280" />
                  <View>
                    <Text style={styles.detailLabel}>Hora de registro</Text>
                    <Text style={styles.detailValue}>
                      {selected.markedAt
                        ? formatActionDateTime(selected.markedAt, '—')
                        : 'Sin registro'}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  body: { paddingHorizontal: 24, paddingVertical: 18, paddingBottom: 30 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statMiniCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statMiniCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF7F7',
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statNumber: { fontSize: 22, fontWeight: '900', color: '#1F2937' },
  statMiniLabel: { marginTop: 2, fontSize: 12, color: '#6B7280' },
  percentCard: {
    marginTop: 14,
    borderRadius: 14,
    padding: 16,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  percentSub: { color: 'rgba(255,255,255,0.80)' },
  percentValue: { marginTop: 2, color: '#fff', fontSize: 28, fontWeight: '900' },
  percentIconWrap: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: 'rgba(255,255,255,0.30)', alignItems: 'center', justifyContent: 'center' },
  filterBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterText: { color: '#374151', fontWeight: '700' },
  dropdown: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemActive: { backgroundColor: 'rgba(185,28,28,0.06)' },
  dropdownText: { color: '#374151' },
  dropdownTextActive: { color: COLORS.primary, fontWeight: '800' },
  recordCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
    marginBottom: 12,
  },
  recordIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  recordTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  recordSubject: { fontWeight: '900', color: '#1F2937', fontSize: 14 },
  recordProf: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillText: { fontWeight: '900', fontSize: 12 },
  recordMetaRow: { marginTop: 10, flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#6B7280', fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { color: '#6B7280' },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  detailKicker: { fontSize: 12, color: '#6B7280', fontWeight: '700' },
  detailTitle: { marginTop: 4, fontSize: 18, fontWeight: '900', color: '#111827' },
  detailClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailStatus: {
    marginTop: 14,
    marginBottom: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  detailStatusText: { fontWeight: '800', fontSize: 13 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  detailLabel: { fontSize: 12, color: '#6B7280' },
  detailValue: { marginTop: 2, fontWeight: '800', color: '#1F2937' },
});
