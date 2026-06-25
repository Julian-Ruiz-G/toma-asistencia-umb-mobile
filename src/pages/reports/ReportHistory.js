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
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  Search,
  Trash2,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';

export default function ReportHistory({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormat, setFilterFormat] = useState('all');
  const [actionsFor, setActionsFor] = useState(null);

  const reports = useMemo(
    () => [
      { id: '1', title: 'Asistencia Abril 2024', subject: 'Cálculo Diferencial', group: 'Grupo A', dateRange: '01/04 - 30/04', createdAt: '2024-04-30 14:30', format: 'xlsx', status: 'ready', size: '45 KB', downloads: 3 },
      { id: '2', title: 'Resumen Semestral', subject: 'Física I', group: 'Grupo B', dateRange: 'Ene - Abr 2024', createdAt: '2024-04-28 09:15', format: 'pdf', status: 'ready', size: '128 KB', downloads: 5 },
      { id: '3', title: 'Tendencias Asistencia', subject: 'Programación', group: 'Grupo C', dateRange: '01/03 - 31/03', createdAt: '2024-04-25 16:45', format: 'xlsx', status: 'ready', size: '32 KB', downloads: 1 },
      { id: '4', title: 'Reporte Comparativo', subject: 'Base de Datos', group: 'Todos', dateRange: '01/04 - 15/04', createdAt: '2024-04-20 11:20', format: 'csv', status: 'ready', size: '18 KB', downloads: 2 },
      { id: '5', title: 'Asistencia Semana 17', subject: 'Ética Profesional', group: 'Grupo D', dateRange: '22/04 - 26/04', createdAt: '2024-04-26 18:00', format: 'xlsx', status: 'generating', size: '-', downloads: 0 },
      { id: '6', title: 'Reporte Fallido', subject: 'Cálculo Diferencial', group: 'Grupo A', dateRange: '01/02 - 15/02', createdAt: '2024-02-15 10:12', format: 'pdf', status: 'error', size: '-', downloads: 0 },
    ],
    []
  );

  const formats = useMemo(
    () => [
      { v: 'all', t: 'Todos' },
      { v: 'xlsx', t: 'XLSX' },
      { v: 'pdf', t: 'PDF' },
      { v: 'csv', t: 'CSV' },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) => {
      const matchesQuery = !q || r.title.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.group.toLowerCase().includes(q);
      const matchesFormat = filterFormat === 'all' || r.format === filterFormat;
      return matchesQuery && matchesFormat;
    });
  }, [reports, searchQuery, filterFormat]);

  const statusCfg = (s) => {
    if (s === 'ready') return { Icon: CheckCircle, bg: '#ECFDF5', border: '#BBF7D0', text: '#16A34A', label: 'Listo' };
    if (s === 'generating') return { Icon: Clock, bg: '#FFFBEB', border: '#FDE68A', text: '#A16207', label: 'Generando' };
    return { Icon: AlertCircle, bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', label: 'Error' };
  };

  const formatIcon = (f) => {
    if (f === 'xlsx') return FileSpreadsheet;
    if (f === 'pdf') return FileText;
    return FileText;
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Historial</Text>
          <Text style={styles.headerSubtitle}>Reportes generados</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.searchWrap}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar reporte..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {formats.map((f) => {
            const active = filterFormat === f.v;
            return (
              <Pressable
                key={f.v}
                onPress={() => setFilterFormat(f.v)}
                style={[styles.filterPill, active ? styles.filterPillActive : null]}
              >
                <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{f.t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ height: 12 }} />

        {filtered.map((r) => {
          const cfg = statusCfg(r.status);
          const Icon = formatIcon(r.format);
          return (
            <View key={r.id} style={[styles.item, { borderColor: cfg.border, backgroundColor: r.status === 'ready' ? '#fff' : cfg.bg }]}>
              <View style={styles.itemTop}>
                <View style={styles.itemLeft}>
                  <View style={styles.fileIcon}>
                    <Icon size={20} color={r.format === 'xlsx' ? '#16A34A' : '#4B5563'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{r.title}</Text>
                    <Text style={styles.itemSub}>{r.subject} • {r.group}</Text>
                    <Text style={styles.itemMeta}>{r.dateRange} • {r.createdAt}</Text>
                  </View>
                </View>
                <Pressable onPress={() => setActionsFor(actionsFor === r.id ? null : r.id)} style={styles.moreBtn}>
                  <MoreVertical size={18} color="#9CA3AF" />
                </Pressable>
              </View>

              <View style={styles.itemBottom}>
                <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}
>
                  <cfg.Icon size={14} color={cfg.text} />
                  <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
                <Text style={styles.bottomMeta}>{r.format.toUpperCase()} • {r.size} • {r.downloads} descargas</Text>
              </View>

              {actionsFor === r.id ? (
                <View style={styles.actionsRow}>
                  <Pressable onPress={() => { setActionsFor(null); navigation.navigate('ReportPreview'); }} style={styles.actionBtn}>
                    <Eye size={16} color="#2563EB" />
                    <Text style={[styles.actionText, { color: '#2563EB' }]}>Ver</Text>
                  </Pressable>
                  <Pressable onPress={() => setActionsFor(null)} style={styles.actionBtn}>
                    <Download size={16} color="#16A34A" />
                    <Text style={[styles.actionText, { color: '#16A34A' }]}>Descargar</Text>
                  </Pressable>
                  <Pressable onPress={() => setActionsFor(null)} style={styles.actionBtn}>
                    <Trash2 size={16} color="#DC2626" />
                    <Text style={[styles.actionText, { color: '#DC2626' }]}>Eliminar</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptyText}>No se encontraron reportes con esos filtros.</Text>
          </View>
        ) : null}

        <View style={{ height: 18 }} />
        <Button fullWidth variant="outline" onPress={() => navigation.goBack()}>
          Volver
        </Button>
        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal visible={false} transparent />
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
  searchWrap: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, color: '#111827' },
  filtersRow: { gap: 10, paddingTop: 12, paddingBottom: 2 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { color: '#6B7280', fontWeight: '800' },
  filterTextActive: { color: '#fff' },
  item: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  itemLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  fileIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontWeight: '900', color: '#111827' },
  itemSub: { marginTop: 2, color: '#6B7280' },
  itemMeta: { marginTop: 6, color: '#9CA3AF', fontSize: 12 },
  moreBtn: { padding: 8, borderRadius: 12 },
  itemBottom: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontWeight: '900', fontSize: 12 },
  bottomMeta: { color: '#6B7280', fontSize: 12 },
  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#fff' },
  actionText: { fontWeight: '900' },
  emptyWrap: { alignItems: 'center', paddingVertical: 30 },
  emptyTitle: { fontWeight: '900', color: '#111827' },
  emptyText: { marginTop: 6, color: '#6B7280', textAlign: 'center' },
});
