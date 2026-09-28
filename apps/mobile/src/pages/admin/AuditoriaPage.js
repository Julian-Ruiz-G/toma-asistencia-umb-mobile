import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Download,
  Eye,
  Edit,
  Search,
  Trash2,
} from 'lucide-react-native';

import OverlayDismiss from '../../components/OverlayDismiss';
import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import { ADMIN_LOGS_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { AdminNavButtons, useAdminDrawer } from '../../components/AdminDrawer';

function classifyAction(action) {
  const value = String(action || '').toLowerCase();
  if (value.includes('delete') || value.includes('remove')) return 'delete';
  if (value.includes('export') || value.includes('report')) return 'export';
  if (value.includes('create') || value.includes('register') || value.includes('submit')) return 'create';
  if (value.includes('update') || value.includes('set-') || value.includes('change') || value.includes('review') || value.includes('reset')) return 'update';
  return 'view';
}

function formatWhen(createdAt) {
  const n = Number(createdAt || 0);
  if (!n) return '';
  const d = new Date(n > 1e12 ? n : n * 1000);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function resourceLabel(entry) {
  const action = String(entry.actionName || 'evento');
  const details = entry.details;
  if (details && typeof details === 'object') {
    const extra = details.teacherEmail || details.studentEmail || details.classId || details.sessionId || '';
    return extra ? `${action} · ${extra}` : action;
  }
  return action;
}

const actionConfig = {
  view: { Icon: Eye, color: COLORS.infoStrong, bg: COLORS.infoBg, label: 'Visualización' },
  create: { Icon: Edit, color: COLORS.successStrong, bg: COLORS.successBg, label: 'Creación' },
  update: { Icon: Edit, color: COLORS.warning, bg: COLORS.warningBg, label: 'Modificación' },
  delete: { Icon: Trash2, color: COLORS.dangerStrong, bg: COLORS.dangerBg, label: 'Eliminación' },
  export: { Icon: Download, color: COLORS.icon, bg: COLORS.surface, label: 'Exportación' },
};

export default function AuditoriaPage({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useAdminDrawer(navigation, 'AdminAudit');
  const { authToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [audits, setAudits] = useState([]);

  useEffect(() => {
    (async () => {
      if (!authToken || !ADMIN_LOGS_URL) return;
      try {
        const resp = await fetch(ADMIN_LOGS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ limit: 300 }),
        });
        const text = await resp.text();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }
        if (!resp.ok) return;
        const arr = Array.isArray(json?.logs) ? json.logs : [];
        setAudits(arr.map((x, idx) => ({
          id: String(x?.id || idx),
          timestamp: formatWhen(x?.createdAt),
          user: String(x?.actorEmail || 'Sistema'),
          userRole: String(x?.actorRole || ''),
          action: classifyAction(x?.action),
          actionName: String(x?.action || ''),
          resource: '',
          details: x?.details,
          changes: x?.details ? JSON.stringify(x.details) : '',
        })).map((entry) => ({ ...entry, resource: resourceLabel(entry) })));
      } catch {
        setAudits([]);
      }
    })();
  }, [authToken]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return audits.filter((a) => {
      const matchesSearch =
        !q ||
        a.user.toLowerCase().includes(q) ||
        a.resource.toLowerCase().includes(q) ||
        a.userRole.toLowerCase().includes(q);
      const matchesAction = actionFilter === 'all' || a.action === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [searchQuery, actionFilter, audits]);

  const stats = useMemo(() => {
    const out = {};
    Object.keys(actionConfig).forEach((k) => (out[k] = audits.filter((a) => a.action === k).length));
    return out;
  }, [audits]);

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <AdminNavButtons onBack={goBack} onMenu={openDrawer} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Auditoría</Text>
          <Text style={styles.headerSubtitle}>Registro de acciones</Text>
        </View>
        <Pressable onPress={() => {}} style={styles.iconBtn}>
          <Download size={18} color={COLORS.icon} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statsRow}>
          {Object.entries(actionConfig).map(([k, cfg]) => (
            <View key={k} style={styles.statMini}>
              <View style={[styles.statIcon, { backgroundColor: cfg.bg }]}>
                <cfg.Icon size={14} color={cfg.color} />
              </View>
              <Text style={styles.statNum}>{stats[k]}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.filtersCard}>
          <View style={styles.searchWrap}>
            <Search size={16} color={COLORS.placeholder} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar usuario o recurso..."
              placeholderTextColor={COLORS.placeholder}
              style={styles.searchInput}
            />
          </View>

          <View style={{ height: 10 }} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
            <Pressable
              onPress={() => setActionFilter('all')}
              style={[styles.pill, actionFilter === 'all' ? styles.pillActive : null]}
            >
              <Text style={[styles.pillText, actionFilter === 'all' ? styles.pillTextActive : null]}>Todas</Text>
            </Pressable>
            {Object.entries(actionConfig).map(([k, cfg]) => {
              const active = actionFilter === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setActionFilter(k)}
                  style={[styles.pill, active ? styles.pillActive : null]}
                >
                  <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{cfg.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.listCard}>
          {filtered.map((entry) => {
            const cfg = actionConfig[entry.action] || actionConfig.view;
            return (
              <Pressable key={entry.id} onPress={() => setSelectedEntry(entry)} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: cfg.bg }]}>
                  <cfg.Icon size={16} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.metaRow}>
                    <Text style={styles.timeText}>{String(entry.timestamp).split(' ')[1] || ''}</Text>
                    <View style={[styles.actionPill, { backgroundColor: cfg.bg }]}
>
                      <Text style={[styles.actionText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.userText}>{entry.user}</Text>
                  <Text style={styles.resourceText}>{entry.resource}</Text>
                  <Text style={styles.ipText}>{entry.userRole || 'sin rol'}</Text>
                </View>
              </Pressable>
            );
          })}

          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptyText}>No hay registros para esos filtros.</Text>
            </View>
          ) : null}
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal visible={!!selectedEntry} transparent animationType="fade" onRequestClose={() => setSelectedEntry(null)}>
        <OverlayDismiss style={styles.modalOverlay} onClose={() => setSelectedEntry(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Detalle de Auditoría</Text>
            <Text style={styles.modalText}>ID: {selectedEntry?.id || ''}</Text>

            <View style={{ height: 12 }} />

            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Usuario</Text>
              <Text style={styles.detailVal}>{selectedEntry?.user || ''}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Acción</Text>
              <Text style={styles.detailVal}>{actionConfig[selectedEntry?.action]?.label || ''}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Recurso</Text>
              <Text style={styles.detailVal}>{selectedEntry?.resource || ''}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Rol</Text>
              <Text style={styles.detailVal}>{selectedEntry?.userRole || '—'}</Text>
            </View>
            {selectedEntry?.changes ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Cambios</Text>
                <Text style={styles.detailVal}>{selectedEntry.changes}</Text>
              </View>
            ) : null}

            <View style={{ height: 14 }} />
            <Button fullWidth onPress={() => setSelectedEntry(null)}>Cerrar</Button>
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
  iconBtn: { padding: 10, borderRadius: 14, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  body: { padding: 16, paddingBottom: 26 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statMini: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 10, alignItems: 'center' },
  statIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statNum: { fontWeight: '900', color: COLORS.text, fontSize: 16 },
  filtersCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: COLORS.text },
  pillsRow: { gap: 10 },
  pill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.muted, fontWeight: '900', fontSize: 12 },
  pillTextActive: { color: COLORS.white },
  listCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  row: { padding: 12, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  timeText: { color: COLORS.muted, fontFamily: 'monospace', fontSize: 10 },
  actionPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  actionText: { fontWeight: '900', fontSize: 10 },
  userText: { fontWeight: '900', color: COLORS.text },
  resourceText: { marginTop: 2, color: COLORS.muted },
  ipText: { marginTop: 6, color: COLORS.placeholder, fontFamily: 'monospace', fontSize: 10 },
  emptyWrap: { alignItems: 'center', paddingVertical: 22 },
  emptyTitle: { fontWeight: '900', color: COLORS.text },
  emptyText: { marginTop: 6, color: COLORS.muted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 },
  modalTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  modalText: { marginTop: 6, color: COLORS.muted },
  detailRow: { marginTop: 10 },
  detailKey: { color: COLORS.muted, fontSize: 12 },
  detailVal: { marginTop: 2, color: COLORS.text, fontWeight: '800' },
});
