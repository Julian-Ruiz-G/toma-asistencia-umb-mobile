import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Mail,
  Search,
  Send,
  XCircle,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { ADMIN_CONSENTS_URL } from '../../config';
import { useAuth } from '../../state/auth';

const mockConsentimientos = [
  { id: '1', studentName: 'Juan Pérez', studentId: '202301099', type: 'biometric', status: 'approved', requestedDate: '2024-01-10', responseDate: '2024-01-12', expiryDate: '2025-01-12' },
  { id: '2', studentName: 'María López', studentId: '202302156', type: 'data', status: 'pending', requestedDate: '2024-01-15' },
  { id: '3', studentName: 'Carlos Ruiz', studentId: '202301088', type: 'photo', status: 'rejected', requestedDate: '2024-01-08', responseDate: '2024-01-09' },
  { id: '4', studentName: 'Ana García', studentId: '202303201', type: 'location', status: 'approved', requestedDate: '2024-01-05', responseDate: '2024-01-06', expiryDate: '2025-01-06' },
  { id: '5', studentName: 'Pedro Martínez', studentId: '202301045', type: 'biometric', status: 'expired', requestedDate: '2023-01-10', responseDate: '2023-01-12', expiryDate: '2024-01-12' },
  { id: '6', studentName: 'Laura Sánchez', studentId: '202302178', type: 'data', status: 'pending', requestedDate: '2024-01-14' },
];

const typeConfig = {
  biometric: { label: 'Datos Biométricos', color: '#7C3AED', bg: '#F3E8FF' },
  data: { label: 'Datos Personales', color: '#2563EB', bg: '#DBEAFE' },
  photo: { label: 'Uso de Fotografía', color: '#DB2777', bg: '#FCE7F3' },
  location: { label: 'Ubicación GPS', color: '#EA580C', bg: '#FFEDD5' },
};

const statusConfig = {
  pending: { Icon: Clock, color: '#A16207', bg: '#FEF3C7', label: 'Pendiente' },
  approved: { Icon: CheckCircle, color: '#16A34A', bg: '#DCFCE7', label: 'Aprobado' },
  rejected: { Icon: XCircle, color: '#B91C1C', bg: '#FEE2E2', label: 'Rechazado' },
  expired: { Icon: AlertCircle, color: '#4B5563', bg: '#F3F4F6', label: 'Expirado' },
};

export default function ConsentimientosPage({ navigation }) {
  const { authToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);

  const [consents, setConsents] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        if (!authToken) return;
        if (!ADMIN_CONSENTS_URL) return;
        const resp = await fetch(ADMIN_CONSENTS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({}),
        });
        const text = await resp.text();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }
        if (!resp.ok) return;
        const arr = Array.isArray(json?.consents) ? json.consents : [];
        const mapped = arr.map((c, idx) => ({
          id: String(c?.email || idx),
          studentName: String(c?.fullName || c?.email || ''),
          studentId: String(c?.studentCode || ''),
          type: 'biometric',
          status: String(c?.status || 'pending'),
          requestedDate: String(c?.updatedAt || ''),
        }));
        setConsents(mapped);
      } catch {
        // ignore
      }
    })();
  }, [authToken]);

  const stats = useMemo(() => {
    return {
      total: consents.length,
      pending: consents.filter((c) => c.status === 'pending').length,
      approved: consents.filter((c) => c.status === 'approved').length,
      expired: consents.filter((c) => c.status === 'expired').length,
    };
  }, [consents]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return consents.filter((c) => {
      const matchesSearch = !q || c.studentName.toLowerCase().includes(q) || c.studentId.toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || c.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [searchQuery, typeFilter, statusFilter]);

  const typeOptions = useMemo(() => ['all', 'biometric', 'data', 'photo', 'location'], []);
  const statusOptions = useMemo(() => ['all', 'pending', 'approved', 'rejected', 'expired'], []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#4B5563" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Consentimientos</Text>
          <Text style={styles.headerSubtitle}>Gestión de permisos</Text>
        </View>
        <Pressable onPress={() => setShowNewRequestModal(true)} style={styles.sendBtn}>
          <Send size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statsRow}>
          <View style={styles.statMini}><Text style={styles.statNum}>{stats.total}</Text><Text style={styles.statLbl}>Total</Text></View>
          <View style={styles.statMini}><Text style={[styles.statNum, { color: '#A16207' }]}>{stats.pending}</Text><Text style={styles.statLbl}>Pend.</Text></View>
          <View style={styles.statMini}><Text style={[styles.statNum, { color: '#16A34A' }]}>{stats.approved}</Text><Text style={styles.statLbl}>Ap.</Text></View>
          <View style={styles.statMini}><Text style={[styles.statNum, { color: '#4B5563' }]}>{stats.expired}</Text><Text style={styles.statLbl}>Exp.</Text></View>
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.filtersCard}>
          <View style={styles.searchWrap}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar estudiante..."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>

          <View style={{ height: 10 }} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
            {typeOptions.map((t) => {
              const active = typeFilter === t;
              const label = t === 'all' ? 'Todos' : typeConfig[t].label;
              return (
                <Pressable key={t} onPress={() => setTypeFilter(t)} style={[styles.pill, active ? styles.pillActive : null]}>
                  <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ height: 10 }} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
            {statusOptions.map((s) => {
              const active = statusFilter === s;
              const label = s === 'all' ? 'Estados' : statusConfig[s].label;
              return (
                <Pressable key={s} onPress={() => setStatusFilter(s)} style={[styles.pill, active ? styles.pillActive : null]}>
                  <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.listCard}>
          {filtered.map((item) => {
            const typeCfg = typeConfig[item.type];
            const statusCfg = statusConfig[item.status];
            return (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={[styles.tag, { backgroundColor: typeCfg.bg }]}
>
                    <Text style={[styles.tagText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: statusCfg.bg, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
>
                    <statusCfg.Icon size={14} color={statusCfg.color} />
                    <Text style={[styles.tagText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                  </View>
                </View>
                <Text style={styles.studentName}>{item.studentName}</Text>
                <Text style={styles.studentId}>{item.studentId}</Text>
                <Text style={styles.smallMeta}>Solicitado: {item.requestedDate}</Text>
              </View>
            );
          })}

          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptyText}>No hay consentimientos para esos filtros.</Text>
            </View>
          ) : null}
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal visible={showNewRequestModal} transparent animationType="fade" onRequestClose={() => setShowNewRequestModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva Solicitud</Text>
            <Text style={styles.modalText}>Formulario simplificado (mock)</Text>

            <View style={{ height: 12 }} />
            <Button fullWidth onPress={() => setShowNewRequestModal(false)}>
              Enviar
            </Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="outline" onPress={() => setShowNewRequestModal(false)}>
              Cancelar
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#F3F4F6' },
  sendBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontWeight: '900', color: '#111827', fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  body: { padding: 16, paddingBottom: 26 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statMini: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 10, alignItems: 'center' },
  statNum: { fontWeight: '900', color: '#111827', fontSize: 16 },
  statLbl: { marginTop: 2, color: '#6B7280', fontSize: 10 },
  filtersCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: '#111827' },
  pillsRow: { gap: 10 },
  pill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: '#6B7280', fontWeight: '900', fontSize: 12 },
  pillTextActive: { color: '#fff' },
  listCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowTop: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  tagText: { fontWeight: '900', fontSize: 11 },
  studentName: { marginTop: 10, fontWeight: '900', color: '#111827' },
  studentId: { marginTop: 2, color: '#6B7280' },
  smallMeta: { marginTop: 6, color: '#9CA3AF', fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 22 },
  emptyTitle: { fontWeight: '900', color: '#111827' },
  emptyText: { marginTop: 6, color: '#6B7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 },
  modalTitle: { fontWeight: '900', color: '#111827', fontSize: 18 },
  modalText: { marginTop: 6, color: '#6B7280' },
});
