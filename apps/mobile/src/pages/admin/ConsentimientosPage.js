import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle, Clock, Search, Send } from 'lucide-react-native';

import { AdminNavButtons, useAdminDrawer } from '../../components/AdminDrawer';
import RequestConsentsModal from '../../components/RequestConsentsModal';
import { ADMIN_CONSENTS_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { appAlert } from '../../ui/appNotice';
import { useColors } from '../../ui/ThemeContext';
import { personDisplayName } from '../../utils/displayName';
import { formatActionDateTime } from '../../utils/formatDateTime';
import { requestProfileCompletion } from '../../utils/profileGaps';

const ROLE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'student', label: 'Estudiantes' },
  { key: 'teacher', label: 'Docentes' },
];
const STATUS_FILTERS = [
  { key: 'all', label: 'Cualquier estado' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'approved', label: 'Al día' },
];
const MISSING_LABEL = { terms: 'Términos', privacy: 'Privacidad', biometric: 'Biometría' };

function toRow(c) {
  const role = c?.role === 'teacher' ? 'teacher' : 'student';
  const terms = c?.acceptTerms === true;
  const privacy = c?.acceptPrivacy === true;
  const biometric = role === 'student' ? c?.biometricConsent === true || c?.hasFace === true : null;
  // La Lambda nueva envía `missing`; con la anterior se calcula aquí.
  const missing = Array.isArray(c?.missing)
    ? c.missing
    : [!terms && 'terms', !privacy && 'privacy', role === 'student' && !biometric && 'biometric'].filter(Boolean);
  return {
    id: `${role}:${c?.email || ''}`,
    role,
    email: String(c?.email || ''),
    name: personDisplayName(c?.fullName, c?.email || 'Sin nombre'),
    code: String((role === 'teacher' ? c?.teacherCode : c?.studentCode) || ''),
    terms,
    privacy,
    biometric,
    missing,
    status: missing.length ? 'pending' : 'approved',
    updatedAt: c?.updatedAt || null,
  };
}

export default function ConsentimientosPage({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useAdminDrawer(navigation, 'AdminConsents');
  const { authToken } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showRequestAll, setShowRequestAll] = useState(false);
  const [requesting, setRequesting] = useState('');
  const [requested, setRequested] = useState({});

  const load = useCallback(async () => {
    if (!authToken || !ADMIN_CONSENTS_URL) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(ADMIN_CONSENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({}),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) throw new Error(json?.message || json?.error || `HTTP ${resp.status}`);
      setRows((Array.isArray(json?.consents) ? json.consents : []).map(toRow));
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los consentimientos.');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'pending');
    return {
      total: rows.length,
      approved: rows.length - pending.length,
      pending: pending.length,
      studentsPending: pending.filter((r) => r.role === 'student').length,
      teachersPending: pending.filter((r) => r.role === 'teacher').length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== 'all' && r.role !== roleFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.name, r.email, r.code].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, query, roleFilter, statusFilter]);

  const requestOne = async (row) => {
    setRequesting(row.id);
    try {
      await requestProfileCompletion(authToken, { email: row.email, role: row.role, consentsOnly: true });
      setRequested((prev) => ({ ...prev, [row.id]: true }));
    } catch (e) {
      appAlert('No se pudo enviar', e?.message || String(e));
    } finally {
      setRequesting('');
    }
  };

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <AdminNavButtons onBack={goBack} onMenu={openDrawer} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Consentimientos</Text>
          <Text style={styles.headerSubtitle}>Estudiantes y docentes</Text>
        </View>
        <Pressable
          onPress={() => setShowRequestAll(true)}
          style={styles.sendBtn}
          accessibilityLabel="Pedir consentimientos pendientes"
        >
          <Send size={18} color={COLORS.white} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading && rows.length > 0} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.statsRow}>
          <Stat value={stats.total} label="Total" styles={styles} />
          <Stat value={stats.approved} label="Al día" styles={styles} color={COLORS.successStrong} />
          <Stat value={stats.studentsPending} label="Est. pend." styles={styles} color={COLORS.warning} />
          <Stat value={stats.teachersPending} label="Doc. pend." styles={styles} color={COLORS.warning} />
        </View>

        {stats.pending > 0 ? (
          <Pressable onPress={() => setShowRequestAll(true)} style={styles.requestAllBtn}>
            <Send size={16} color={COLORS.primary} />
            <Text style={styles.requestAllText}>
              {`Pedir a los ${stats.pending} pendientes`}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.filtersCard}>
          <View style={styles.searchWrap}>
            <Search size={16} color={COLORS.placeholder} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nombre, código o correo"
              placeholderTextColor={COLORS.placeholder}
              style={styles.searchInput}
            />
          </View>
          <Pills options={ROLE_FILTERS} value={roleFilter} onChange={setRoleFilter} styles={styles} />
          <Pills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} styles={styles} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && rows.length === 0 ? <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} /> : null}

        <View style={styles.listCard}>
          {filtered.map((item, i) => {
            const pending = item.status === 'pending';
            const sent = requested[item.id];
            return (
              <View key={item.id} style={[styles.row, i < filtered.length - 1 ? styles.rowDivider : null]}>
                <View style={styles.rowTop}>
                  <View style={[styles.tag, styles.tagRole]}>
                    <Text style={[styles.tagText, styles.tagRoleText]}>{item.role === 'teacher' ? 'Docente' : 'Estudiante'}</Text>
                  </View>
                  <View style={[styles.tag, pending ? styles.tagPending : styles.tagOk]}>
                    {pending
                      ? <Clock size={12} color={COLORS.warning} />
                      : <CheckCircle size={12} color={COLORS.successStrong} />}
                    <Text style={[styles.tagText, { color: pending ? COLORS.warning : COLORS.successStrong }]}>
                      {pending ? 'Pendiente' : 'Al día'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{[item.code, item.email].filter(Boolean).join(' · ')}</Text>
                <View style={styles.flagsRow}>
                  <Flag on={item.terms} label="Términos" styles={styles} />
                  <Flag on={item.privacy} label="Privacidad" styles={styles} />
                  {item.role === 'student' ? <Flag on={item.biometric} label="Biometría" styles={styles} /> : null}
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.smallMeta}>
                    {item.updatedAt ? `Actualizado: ${formatActionDateTime(item.updatedAt)}` : 'Sin cambios registrados'}
                  </Text>
                  {pending ? (
                    sent ? (
                      <Text style={styles.sentText}>Solicitud enviada</Text>
                    ) : (
                      <Pressable
                        onPress={() => requestOne(item)}
                        disabled={requesting === item.id}
                        style={styles.askBtn}
                        accessibilityLabel={`Pedir ${item.missing.map((m) => MISSING_LABEL[m] || m).join(', ')}`}
                      >
                        {requesting === item.id
                          ? <ActivityIndicator size="small" color={COLORS.white} />
                          : <Text style={styles.askText}>Pedir</Text>}
                      </Pressable>
                    )
                  ) : null}
                </View>
              </View>
            );
          })}

          {!loading && filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptyText}>No hay personas con esos filtros.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <RequestConsentsModal
        visible={showRequestAll}
        onClose={() => setShowRequestAll(false)}
        pending={{ studentsPending: stats.studentsPending, teachersPending: stats.teachersPending }}
        onSent={() => {
          const next = {};
          rows.filter((r) => r.status === 'pending').forEach((r) => { next[r.id] = true; });
          setRequested((prev) => ({ ...prev, ...next }));
        }}
      />
    </View>
  );
}

function Stat({ value, label, styles, color }) {
  return (
    <View style={styles.statMini}>
      <Text style={[styles.statNum, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function Pills({ options, value, onChange, styles }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.pill, active ? styles.pillActive : null]}>
            <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Flag({ on, label, styles }) {
  return (
    <Text style={[styles.flag, on ? styles.flagOn : styles.flagOff]}>
      {`${label}: ${on ? 'sí' : 'no'}`}
    </Text>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.card, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.surface },
  sendBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  body: { padding: 16, paddingBottom: 32, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statMini: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 10, alignItems: 'center' },
  statNum: { fontWeight: '900', color: COLORS.text, fontSize: 16, fontVariant: ['tabular-nums'] },
  statLbl: { marginTop: 2, color: COLORS.muted, fontSize: 10 },
  requestAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primaryBorder || COLORS.border, backgroundColor: COLORS.primarySoft },
  requestAllText: { color: COLORS.primary, fontWeight: '900' },
  filtersCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12, gap: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: COLORS.text },
  pillsRow: { gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.muted, fontWeight: '900', fontSize: 12 },
  pillTextActive: { color: COLORS.white },
  error: { color: COLORS.danger, fontWeight: '700' },
  listCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  row: { padding: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowTop: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagText: { fontWeight: '900', fontSize: 11 },
  tagRole: { backgroundColor: COLORS.surface },
  tagRoleText: { color: COLORS.textSecondary },
  tagPending: { backgroundColor: COLORS.warningBg },
  tagOk: { backgroundColor: COLORS.successBg },
  name: { marginTop: 10, fontWeight: '900', color: COLORS.text },
  sub: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  flagsRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flag: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  flagOn: { backgroundColor: COLORS.successBg, color: COLORS.success },
  flagOff: { backgroundColor: COLORS.dangerBg, color: COLORS.danger },
  rowBottom: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  smallMeta: { flex: 1, color: COLORS.placeholder, fontSize: 12 },
  askBtn: { minWidth: 72, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primary },
  askText: { color: COLORS.white, fontWeight: '900', fontSize: 12 },
  sentText: { color: COLORS.successStrong, fontWeight: '800', fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 22 },
  emptyTitle: { fontWeight: '900', color: COLORS.text },
  emptyText: { marginTop: 6, color: COLORS.muted },
});
