import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Search,
  Send,
  XCircle,
} from 'lucide-react-native';

import OverlayDismiss from '../../components/OverlayDismiss';
import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
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
  biometric: { label: 'Datos biométricos', color: COLORS.textSecondary, bg: COLORS.surface },
  terms: { label: 'Términos', color: COLORS.textSecondary, bg: COLORS.surface },
  privacy: { label: 'Privacidad', color: COLORS.textSecondary, bg: COLORS.surface },
};

const statusConfig = {
  pending: { Icon: Clock, color: COLORS.warning, bg: COLORS.warningBg, label: 'Pendiente' },
  approved: { Icon: CheckCircle, color: COLORS.successStrong, bg: COLORS.successBg, label: 'Aprobado' },
  rejected: { Icon: XCircle, color: COLORS.danger, bg: COLORS.dangerBg, label: 'No otorgado' },
};

function formatConsentDate(value) {
  const n = Number(value);
  if (!n) return '—';
  const ms = n > 1e12 ? n : n * 1000;
  try {
    return new Date(ms).toLocaleString('es-CO');
  } catch {
    return String(value);
  }
}

export default function ConsentimientosPage({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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
        const mapped = arr.map((c, idx) => {
          const biometric = c?.biometricConsent === true || c?.hasFace === true;
          const terms = c?.acceptTerms === true;
          const privacy = c?.acceptPrivacy === true;
          const allOk = biometric && terms && privacy;
          return {
            id: String(c?.email || idx),
            studentName: String(c?.fullName || c?.email || ''),
            studentId: String(c?.studentCode || ''),
            email: String(c?.email || ''),
            type: 'biometric',
            status: allOk ? 'approved' : biometric || terms || privacy ? 'pending' : 'rejected',
            acceptTerms: terms,
            acceptPrivacy: privacy,
            biometricConsent: biometric,
            requestedDate: formatConsentDate(c?.updatedAt),
          };
        });
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
      rejected: consents.filter((c) => c.status === 'rejected').length,
    };
  }, [consents]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return consents.filter((c) => {
      const matchesSearch = !q || c.studentName.toLowerCase().includes(q) || c.studentId.toLowerCase().includes(q);
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'biometric' && c.biometricConsent) ||
        (typeFilter === 'terms' && c.acceptTerms) ||
        (typeFilter === 'privacy' && c.acceptPrivacy);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [searchQuery, typeFilter, statusFilter, consents]);

  const typeOptions = useMemo(() => ['all', 'biometric', 'terms', 'privacy'], []);
  const statusOptions = useMemo(() => ['all', 'pending', 'approved', 'rejected'], []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={COLORS.icon} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Consentimientos</Text>
          <Text style={styles.headerSubtitle}>Gestión de permisos</Text>
        </View>
        <Pressable onPress={() => setShowNewRequestModal(true)} style={styles.sendBtn}>
          <Send size={18} color={COLORS.white} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statsRow}>
          <View style={styles.statMini}><Text style={styles.statNum}>{stats.total}</Text><Text style={styles.statLbl}>Total</Text></View>
          <View style={styles.statMini}><Text style={[styles.statNum, { color: COLORS.warning }]}>{stats.pending}</Text><Text style={styles.statLbl}>Pend.</Text></View>
          <View style={styles.statMini}><Text style={[styles.statNum, { color: COLORS.successStrong }]}>{stats.approved}</Text><Text style={styles.statLbl}>Ap.</Text></View>
          <View style={styles.statMini}><Text style={[styles.statNum, { color: COLORS.dangerStrong }]}>{stats.rejected}</Text><Text style={styles.statLbl}>No</Text></View>
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.filtersCard}>
          <View style={styles.searchWrap}>
            <Search size={16} color={COLORS.placeholder} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar estudiante..."
              placeholderTextcolor={COLORS.placeholder}
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
                <Text style={styles.studentId}>{item.studentId || item.email}</Text>
                <View style={styles.flagsRow}>
                  <Text style={[styles.flag, item.acceptTerms ? styles.flagOn : styles.flagOff]}>
                    {item.acceptTerms ? 'Términos: sí' : 'Términos: no'}
                  </Text>
                  <Text style={[styles.flag, item.acceptPrivacy ? styles.flagOn : styles.flagOff]}>
                    {item.acceptPrivacy ? 'Privacidad: sí' : 'Privacidad: no'}
                  </Text>
                  <Text style={[styles.flag, item.biometricConsent ? styles.flagOn : styles.flagOff]}>
                    {item.biometricConsent ? 'Biometría: sí' : 'Biometría: no'}
                  </Text>
                </View>
                <Text style={styles.smallMeta}>Actualizado: {item.requestedDate}</Text>
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
        <OverlayDismiss style={styles.modalOverlay} onClose={() => setShowNewRequestModal(false)}>
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
        </OverlayDismiss>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.card, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.surface },
  sendBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  body: { padding: 16, paddingBottom: 26 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statMini: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 10, alignItems: 'center' },
  statNum: { fontWeight: '900', color: COLORS.text, fontSize: 16 },
  statLbl: { marginTop: 2, color: COLORS.muted, fontSize: 10 },
  filtersCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: COLORS.text },
  pillsRow: { gap: 10 },
  pill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.muted, fontWeight: '900', fontSize: 12 },
  pillTextActive: { color: COLORS.white },
  listCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowTop: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  tagText: { fontWeight: '900', fontSize: 11 },
  studentName: { marginTop: 10, fontWeight: '900', color: COLORS.text },
  studentId: { marginTop: 2, color: COLORS.muted },
  smallMeta: { marginTop: 6, color: COLORS.placeholder, fontSize: 12 },
  flagsRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flag: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  flagOn: { backgroundColor: COLORS.successBg, color: COLORS.success },
  flagOff: { backgroundColor: COLORS.dangerBg, color: COLORS.danger },
  emptyWrap: { alignItems: 'center', paddingVertical: 22 },
  emptyTitle: { fontWeight: '900', color: COLORS.text },
  emptyText: { marginTop: 6, color: COLORS.muted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 },
  modalTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  modalText: { marginTop: 6, color: COLORS.muted },
});
