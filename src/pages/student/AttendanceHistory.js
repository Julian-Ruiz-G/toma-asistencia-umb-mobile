import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Filter,
  XCircle,
} from 'lucide-react-native';
import { COLORS } from '../../ui/theme';

export default function AttendanceHistory({ navigation }) {
  const [filter, setFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  const attendanceData = useMemo(() => ([
    { id: '1', date: '03 Abr 2024', subject: 'Cálculo Diferencial', professor: 'Dra. María González', time: '08:00 AM', status: 'present' },
    { id: '2', date: '03 Abr 2024', subject: 'Física I', professor: 'Dr. Carlos Rodríguez', time: '10:30 AM', status: 'late' },
    { id: '3', date: '02 Abr 2024', subject: 'Programación', professor: 'Ing. Ana Martínez', time: '02:00 PM', status: 'present' },
    { id: '4', date: '01 Abr 2024', subject: 'Base de Datos', professor: 'Dr. Luis Hernández', time: '07:00 AM', status: 'absent' },
    { id: '5', date: '01 Abr 2024', subject: 'Ética Profesional', professor: 'Dra. Carmen Díaz', time: '04:00 PM', status: 'present' },
  ]), []);

  const filtered = useMemo(() => attendanceData.filter(r => filter === 'all' || r.status === filter), [attendanceData, filter]);

  const stats = useMemo(() => {
    const present = attendanceData.filter(r => r.status === 'present').length;
    const late = attendanceData.filter(r => r.status === 'late').length;
    const absent = attendanceData.filter(r => r.status === 'absent').length;
    const total = attendanceData.length;
    return { present, late, absent, total };
  }, [attendanceData]);

  const percent = stats.total ? Math.round((stats.present / stats.total) * 100) : 0;

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
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Historial</Text>
          <Text style={styles.headerSubtitle}>Registro de asistencias</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statsRow}>
          <View style={styles.statMiniCard}>
            <View style={[styles.statIcon, { backgroundColor: '#DCFCE7' }]}>
              <CheckCircle size={20} color="#16A34A" />
            </View>
            <Text style={styles.statNumber}>{stats.present}</Text>
            <Text style={styles.statMiniLabel}>Presentes</Text>
          </View>
          <View style={styles.statMiniCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
              <AlertCircle size={20} color="#A16207" />
            </View>
            <Text style={styles.statNumber}>{stats.late}</Text>
            <Text style={styles.statMiniLabel}>Retardos</Text>
          </View>
          <View style={styles.statMiniCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
              <XCircle size={20} color="#B91C1C" />
            </View>
            <Text style={styles.statNumber}>{stats.absent}</Text>
            <Text style={styles.statMiniLabel}>Ausencias</Text>
          </View>
        </View>

        <View style={styles.percentCard}>
          <View>
            <Text style={styles.percentSub}>Porcentaje de asistencia</Text>
            <Text style={styles.percentValue}>{percent}%</Text>
          </View>
          <View style={styles.percentIconWrap}>
            <BookOpen size={28} color="#fff" />
          </View>
        </View>

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

        {filtered.map((r) => {
          const cfg = statusCfg(r.status);
          return (
            <View key={r.id} style={[styles.recordCard, { borderColor: cfg.border }]}>
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
            </View>
          );
        })}

        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Calendar size={32} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyText}>No hay registros para este filtro</Text>
          </View>
        ) : null}

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
});
