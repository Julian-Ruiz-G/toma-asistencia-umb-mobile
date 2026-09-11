import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  FileEdit,
  RotateCcw,
  Save,
  Search,
  UserCheck,
  XCircle,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';

export default function ManualCorrection({ navigation }) {
  const [students, setStudents] = useState([
    { id: '1', code: '20231045892', name: 'Juan Pérez García', status: 'present', originalStatus: 'absent', time: '08:02 AM' },
    { id: '2', code: '20231045893', name: 'María López Silva', status: 'present', originalStatus: 'present', time: '08:05 AM' },
    { id: '3', code: '20231045894', name: 'Carlos Rodríguez', status: 'late', originalStatus: 'late', time: '08:18 AM', reason: 'Tráfico' },
    { id: '4', code: '20231045895', name: 'Ana Martínez Ruiz', status: 'present', originalStatus: 'present', time: '08:08 AM' },
    { id: '5', code: '20231045896', name: 'Luis Hernández', status: 'absent', originalStatus: 'absent' },
    { id: '6', code: '20231045897', name: 'Carmen Díaz', status: 'present', originalStatus: 'present', time: '08:10 AM' },
    { id: '7', code: '20231045898', name: 'Pedro Sánchez', status: 'absent', originalStatus: 'late', reason: 'Se retiró temprano' },
    { id: '8', code: '20231045899', name: 'Laura Torres', status: 'present', originalStatus: 'present', time: '08:06 AM' },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(null);
  const [reasonInput, setReasonInput] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || String(s.code || '').includes(q)
    );
  }, [students, searchQuery]);

  const stats = useMemo(() => {
    const total = students.length;
    const present = students.filter((s) => s.status === 'present').length;
    const late = students.filter((s) => s.status === 'late').length;
    const absent = students.filter((s) => s.status === 'absent').length;
    const modified = students.filter((s) => s.status !== s.originalStatus).length;
    return { total, present, late, absent, modified };
  }, [students]);

  const updateStatus = (id, newStatus) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (newStatus !== s.status) setHasChanges(true);
        return { ...s, status: newStatus, reason: newStatus === s.originalStatus ? undefined : s.reason };
      })
    );

    if (newStatus === 'absent' || newStatus === 'late') {
      setShowReasonModal(id);
    }
  };

  const saveReason = () => {
    if (!showReasonModal) return;
    setStudents((prev) => prev.map((s) => (s.id === showReasonModal ? { ...s, reason: reasonInput } : s)));
    setShowReasonModal(null);
    setReasonInput('');
  };

  const handleReset = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: s.originalStatus, reason: undefined })));
    setHasChanges(false);
  };

  const handleSave = () => {
    setHasChanges(false);
    navigation.goBack();
  };

  const StatusBtn = ({ label, status, active, icon: Icon, colorBg, colorText }) => (
    <Pressable
      onPress={() => updateStatus(showReasonModal || '', status)}
      style={[styles.statusBtn, active ? { backgroundColor: colorBg } : null]}
    >
      <Icon size={14} color={active ? '#fff' : colorText} />
      <Text style={[styles.statusBtnText, active ? { color: '#fff' } : { color: '#4B5563' }]}>{label}</Text>
    </Pressable>
  );

  const getStatusPill = (status) => {
    if (status === 'present') return { bg: '#ECFDF5', text: '#16A34A', label: 'Presente' };
    if (status === 'late') return { bg: '#FFFBEB', text: '#A16207', label: 'Retardo' };
    return { bg: '#FEF2F2', text: '#B91C1C', label: 'Ausente' };
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Corrección Manual</Text>
          <Text style={styles.headerSubtitle}>Modificar estados de asistencia</Text>
        </View>
        {hasChanges ? (
          <View style={styles.changesPill}>
            <FileEdit size={18} color={COLORS.primary} />
            <Text style={styles.changesText}>{stats.modified} cambios</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statsCell}>
              <Text style={styles.statsNum}>{stats.total}</Text>
              <Text style={styles.statsLbl}>Total</Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={[styles.statsNum, { color: '#16A34A' }]}>{stats.present}</Text>
              <Text style={styles.statsLbl}>Presentes</Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={[styles.statsNum, { color: '#A16207' }]}>{stats.late}</Text>
              <Text style={styles.statsLbl}>Retardos</Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={[styles.statsNum, { color: '#B91C1C' }]}>{stats.absent}</Text>
              <Text style={styles.statsLbl}>Ausentes</Text>
            </View>
          </View>

          {stats.modified > 0 ? (
            <View style={styles.statsBottom}>
              <Text style={styles.modifiedText}>{stats.modified} registros modificados</Text>
              <Pressable onPress={handleReset} style={styles.resetLink}>
                <RotateCcw size={16} color="#6B7280" />
                <Text style={styles.resetText}>Restaurar original</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.searchWrap}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar estudiante por nombre o código..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        <View style={{ height: 12 }} />

        {filtered.map((student) => {
          const mod = student.status !== student.originalStatus;
          const pill = getStatusPill(student.status);

          return (
            <View key={student.id} style={[styles.item, mod ? styles.itemModified : null]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {student.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemName}>{student.name}</Text>
                  {mod ? (
                    <View style={styles.modifiedPill}>
                      <Text style={styles.modifiedPillText}>Modificado</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.itemCode}>{student.code}</Text>

                {student.reason ? (
                  <View style={styles.reasonRow}>
                    <FileEdit size={14} color="#6B7280" />
                    <Text style={styles.reasonText}>{student.reason}</Text>
                  </View>
                ) : null}

                <View style={styles.btnGroup}>
                  <Pressable
                    onPress={() => updateStatus(student.id, 'present')}
                    style={[styles.smallBtn, student.status === 'present' ? styles.smallBtnGreen : null]}
                  >
                    <CheckCircle size={14} color={student.status === 'present' ? '#fff' : '#16A34A'} />
                    <Text style={[styles.smallBtnText, student.status === 'present' ? styles.smallBtnTextOn : null]}>Presente</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => updateStatus(student.id, 'late')}
                    style={[styles.smallBtn, student.status === 'late' ? styles.smallBtnYellow : null]}
                  >
                    <Clock size={14} color={student.status === 'late' ? '#fff' : '#A16207'} />
                    <Text style={[styles.smallBtnText, student.status === 'late' ? styles.smallBtnTextOn : null]}>Retardo</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => updateStatus(student.id, 'absent')}
                    style={[styles.smallBtn, student.status === 'absent' ? styles.smallBtnRed : null]}
                  >
                    <XCircle size={14} color={student.status === 'absent' ? '#fff' : '#B91C1C'} />
                    <Text style={[styles.smallBtnText, student.status === 'absent' ? styles.smallBtnTextOn : null]}>Ausente</Text>
                  </Pressable>
                </View>
              </View>

              {student.time ? <Text style={styles.timeText}>{student.time}</Text> : null}
              <View style={[styles.statePill, { backgroundColor: pill.bg }]}>
                <Text style={[styles.stateText, { color: pill.text }]}>{pill.label}</Text>
              </View>
            </View>
          );
        })}

        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <UserCheck size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No se encontraron estudiantes</Text>
          </View>
        ) : null}

        <View style={{ height: 14 }} />

        <View style={styles.footerBtns}>
          <Button fullWidth variant="outline" onPress={handleReset} disabled={!hasChanges}>
            Cancelar
          </Button>
          <View style={{ height: 10 }} />
          <Button fullWidth onPress={handleSave} disabled={!hasChanges}>
            Guardar Cambios
          </Button>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal visible={!!showReasonModal} transparent animationType="fade" onRequestClose={() => setShowReasonModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <AlertCircle size={28} color="#A16207" />
            </View>
            <Text style={styles.modalTitle}>Motivo del cambio</Text>
            <Text style={styles.modalText}>Por favor indique el motivo de la modificación</Text>
            <View style={{ height: 12 }} />
            <TextInput
              value={reasonInput}
              onChangeText={setReasonInput}
              placeholder="Ej: Estudiante llegó tarde por problemas de transporte..."
              placeholderTextColor="#9CA3AF"
              multiline
              style={styles.modalInput}
            />
            <View style={{ height: 12 }} />
            <Button fullWidth variant="outline" onPress={() => { setShowReasonModal(null); setReasonInput(''); }}>
              Omitir
            </Button>
            <View style={{ height: 10 }} />
            <Button fullWidth onPress={saveReason} disabled={!reasonInput.trim()}>
              Guardar
            </Button>
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
  changesPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(185,28,28,0.08)' },
  changesText: { color: COLORS.primary, fontWeight: '900' },
  body: { paddingHorizontal: 24, paddingVertical: 18, paddingBottom: 30 },
  statsCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statsCell: { flex: 1, alignItems: 'center' },
  statsNum: { fontSize: 18, fontWeight: '900', color: '#1F2937' },
  statsLbl: { marginTop: 2, fontSize: 11, color: '#6B7280' },
  statsBottom: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modifiedText: { color: COLORS.primary, fontWeight: '900' },
  resetLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resetText: { color: '#6B7280', fontWeight: '800' },
  searchWrap: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, color: '#111827' },
  item: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  itemModified: { borderColor: 'rgba(185,28,28,0.30)' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '900', color: '#4B5563' },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemName: { flex: 1, fontWeight: '900', color: '#111827' },
  itemCode: { marginTop: 2, fontSize: 12, color: '#6B7280' },
  modifiedPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(185,28,28,0.10)' },
  modifiedPillText: { color: COLORS.primary, fontWeight: '900', fontSize: 12 },
  reasonRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  reasonText: { color: '#4B5563', flex: 1 },
  btnGroup: { marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F3F4F6' },
  smallBtnText: { fontWeight: '900', color: '#4B5563' },
  smallBtnTextOn: { color: '#fff' },
  smallBtnGreen: { backgroundColor: '#22C55E' },
  smallBtnYellow: { backgroundColor: '#EAB308' },
  smallBtnRed: { backgroundColor: '#EF4444' },
  timeText: { alignSelf: 'flex-start', fontSize: 11, color: '#9CA3AF' },
  statePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  stateText: { fontWeight: '900', fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { marginTop: 10, color: '#6B7280' },
  footerBtns: { marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 },
  modalIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 4 },
  modalTitle: { marginTop: 12, fontSize: 20, fontWeight: '900', textAlign: 'center', color: '#111827' },
  modalText: { marginTop: 6, textAlign: 'center', color: '#6B7280' },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 12, height: 110, textAlignVertical: 'top', color: '#111827' },
});
