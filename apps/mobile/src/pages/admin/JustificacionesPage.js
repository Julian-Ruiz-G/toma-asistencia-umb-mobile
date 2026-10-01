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
import { Search } from 'lucide-react-native';

import { AdminNavButtons, useAdminDrawer } from '../../components/AdminDrawer';
import { MenuButton } from '../../components/RoleDrawer';
import JustificationAttachment from '../../components/JustificationAttachment';
import { LIST_JUSTIFICATIONS_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { useColors } from '../../ui/ThemeContext';
import { personDisplayName } from '../../utils/displayName';
import { colombiaDateLongFromYmd, formatActionDateTime } from '../../utils/formatDateTime';
import { headerTop } from '../../ui/safeArea';

const STATUS = {
  enviada: { label: 'En revisión', tone: 'warning' },
  aprobada: { label: 'Aprobada', tone: 'success' },
  rechazada: { label: 'Rechazada', tone: 'danger' },
  vencida: { label: 'Vencida', tone: 'muted' },
};
const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'enviada', label: 'En revisión' },
  { key: 'aprobada', label: 'Aprobadas' },
  { key: 'rechazada', label: 'Rechazadas' },
  { key: 'vencida', label: 'Vencidas' },
  { key: 'withFile', label: 'Con soporte' },
];

export default function JustificacionesPage({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useAdminDrawer(navigation, 'AdminJustifications');
  const { authToken } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    if (!authToken || !LIST_JUSTIFICATIONS_URL) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(LIST_JUSTIFICATIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({}),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (resp.status === 401) {
        throw new Error('El servidor aún no permite ver justificaciones al administrador. Hay que desplegar la Lambda.');
      }
      if (!resp.ok) throw new Error(json?.message || json?.error || `HTTP ${resp.status}`);
      setRows(Array.isArray(json?.justifications) ? json.justifications : []);
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar las justificaciones.');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const acc = { all: rows.length, withFile: 0 };
    for (const r of rows) {
      acc[r.status] = (acc[r.status] || 0) + 1;
      if (r.hasFile) acc.withFile += 1;
    }
    return acc;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'withFile' ? !r.hasFile : filter !== 'all' && r.status !== filter) return false;
      if (!q) return true;
      return [r.studentName, r.studentEmail, r.className, r.teacherEmail, r.reason]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, query, filter]);

  const toneStyle = (tone) => ({
    warning: [styles.badgeWarning, styles.badgeTextWarning],
    success: [styles.badgeSuccess, styles.badgeTextSuccess],
    danger: [styles.badgeDanger, styles.badgeTextDanger],
    muted: [styles.badgeMuted, styles.badgeTextMuted],
  }[tone] || [styles.badgeMuted, styles.badgeTextMuted]);

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <AdminNavButtons onBack={goBack} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Justificaciones</Text>
          <Text style={styles.headerSubtitle}>
            {loading ? 'Cargando…' : `${counts.all} en total · ${counts.enviada || 0} en revisión`}
          </Text>
        </View>
        <MenuButton onPress={openDrawer} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl tintColor={COLORS.primary} colors={[COLORS.primary]} progressBackgroundColor={COLORS.card} refreshing={loading && rows.length > 0} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchWrap}>
          <Search size={16} color={COLORS.placeholder} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar estudiante, clase, docente o motivo"
            placeholderTextColor={COLORS.placeholder}
            style={styles.searchInput}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.pill, active ? styles.pillActive : null]}>
                <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>
                  {`${f.label} (${counts[f.key] || 0})`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.note}>
          Las aprueba o rechaza el docente de cada materia. Aquí puedes consultarlas y abrir los soportes.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && rows.length === 0 ? <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} /> : null}
        {!loading && !error && filtered.length === 0 ? (
          <Text style={styles.empty}>{rows.length ? 'Ninguna justificación coincide.' : 'Aún no hay justificaciones.'}</Text>
        ) : null}

        {filtered.map((r) => {
          const st = STATUS[r.status] || { label: r.status || '—', tone: 'muted' };
          const [badge, badgeText] = toneStyle(st.tone);
          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{personDisplayName(r.studentName, r.studentEmail || 'Estudiante')}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {r.className || 'Clase'} · {r.sessionDate ? colombiaDateLongFromYmd(r.sessionDate) : 'Sin fecha'}
                  </Text>
                </View>
                <View style={[styles.badge, badge]}>
                  <Text style={[styles.badgeText, badgeText]}>{st.label}</Text>
                </View>
              </View>
              <Text style={styles.reason}>{r.reason}</Text>
              {r.reviewNote ? <Text style={styles.reviewNote}>Nota del docente: {r.reviewNote}</Text> : null}
              <JustificationAttachment row={r} onExpired={load} />
              <Text style={styles.footer} numberOfLines={1}>
                {[r.teacherEmail ? `Docente: ${r.teacherEmail}` : '', r.createdAt ? `Enviada: ${formatActionDateTime(r.createdAt)}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.card, paddingTop: headerTop(12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.surface },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  body: { padding: 16, paddingBottom: 32, gap: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: COLORS.text },
  pillsRow: { gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.muted, fontWeight: '900', fontSize: 12 },
  pillTextActive: { color: COLORS.white },
  note: { color: COLORS.muted, fontSize: 12 },
  error: { color: COLORS.danger, fontWeight: '700' },
  empty: { color: COLORS.textSecondary, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontWeight: '900', color: COLORS.text },
  meta: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  reason: { marginTop: 10, color: COLORS.text, lineHeight: 20 },
  reviewNote: { marginTop: 8, color: COLORS.textSecondary, fontSize: 12 },
  footer: { marginTop: 10, color: COLORS.placeholder, fontSize: 11 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '900' },
  badgeWarning: { backgroundColor: COLORS.warningBg },
  badgeTextWarning: { color: COLORS.warning },
  badgeSuccess: { backgroundColor: COLORS.successBg },
  badgeTextSuccess: { color: COLORS.success },
  badgeDanger: { backgroundColor: COLORS.dangerBg },
  badgeTextDanger: { color: COLORS.danger },
  badgeMuted: { backgroundColor: COLORS.surface },
  badgeTextMuted: { color: COLORS.muted },
});
