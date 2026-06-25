import React, { useEffect, useMemo, useState } from 'react';
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
  Download,
  Info,
  Search,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { ADMIN_LOGS_URL } from '../../config';
import { useAuth } from '../../state/auth';

const mockLogs = [
  { id: '1', timestamp: '2024-01-15 14:32:15', level: 'info', module: 'Auth', message: 'Usuario inició sesión', user: 'admin@umb.edu.co' },
  { id: '2', timestamp: '2024-01-15 14:30:22', level: 'success', module: 'Attendance', message: 'Asistencia registrada exitosamente', user: 'juan.perez@umb.edu.co', details: 'Sesión: MAT-101-2024-01-15' },
  { id: '3', timestamp: '2024-01-15 14:28:05', level: 'warning', module: 'Sync', message: 'Sincronización con Aulanet demorada', details: 'Tiempo de respuesta: 8.5s' },
  { id: '4', timestamp: '2024-01-15 14:25:18', level: 'error', module: 'Database', message: 'Error de conexión a base de datos', details: 'Timeout después de 30s' },
  { id: '5', timestamp: '2024-01-15 14:20:45', level: 'info', module: 'Admin', message: 'Carga masiva iniciada', user: 'admin@umb.edu.co' },
  { id: '6', timestamp: '2024-01-15 14:15:30', level: 'success', module: 'QR', message: 'QR institucional regenerado', user: 'admin@umb.edu.co' },
  { id: '7', timestamp: '2024-01-15 14:10:12', level: 'warning', module: 'FaceRecognition', message: 'Reconocimiento facial con baja confianza', user: 'maria.lopez@umb.edu.co', details: 'Confianza: 65%' },
  { id: '8', timestamp: '2024-01-15 14:05:00', level: 'info', module: 'System', message: 'Backup automático completado', details: 'Tamaño: 2.4GB' },
];

const levelConfig = {
  info: { Icon: Info, color: '#2563EB', bg: '#DBEAFE', label: 'Info' },
  warning: { Icon: AlertCircle, color: '#A16207', bg: '#FEF3C7', label: 'Advertencia' },
  error: { Icon: AlertCircle, color: '#B91C1C', bg: '#FEE2E2', label: 'Error' },
  success: { Icon: CheckCircle, color: '#16A34A', bg: '#DCFCE7', label: 'Éxito' },
};

export default function LogsPage({ navigation }) {
  const { authToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  const [logs, setLogs] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        if (!authToken) return;
        if (!ADMIN_LOGS_URL) return;
        const resp = await fetch(ADMIN_LOGS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ limit: 500 }),
        });
        const text = await resp.text();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }
        if (!resp.ok) {
          const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
          throw new Error(msg);
        }

        const arr = Array.isArray(json?.logs) ? json.logs : [];
        const mapped = arr.map((x) => {
          const ts = Number(x?.createdAt || 0);
          const d = ts ? new Date(ts * 1000) : null;
          const pad = (n) => String(n).padStart(2, '0');
          const timestamp = d
            ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
            : '';
          const module = String(x?.actorRole || 'System');
          const message = String(x?.action || 'event');
          const user = x?.actorEmail ? String(x.actorEmail) : '';
          const details = x?.details ? JSON.stringify(x.details) : '';
          return {
            id: String(x?.id || ''),
            timestamp,
            level: 'info',
            module,
            message,
            user,
            details,
          };
        });
        setLogs(mapped);
      } catch {
        // ignore
      }
    })();
  }, [authToken]);

  const modules = useMemo(() => Array.from(new Set(logs.map((l) => l.module))).filter(Boolean), [logs]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSearch =
        !q ||
        log.message.toLowerCase().includes(q) ||
        log.module.toLowerCase().includes(q) ||
        String(log.user || '').toLowerCase().includes(q);
      const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
      const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
      return matchesSearch && matchesLevel && matchesModule;
    });
  }, [searchQuery, levelFilter, moduleFilter]);

  const stats = useMemo(() => {
    const out = {};
    Object.keys(levelConfig).forEach((k) => {
      out[k] = logs.filter((l) => l.level === k).length;
    });
    return out;
  }, [logs]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#4B5563" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Logs</Text>
          <Text style={styles.headerSubtitle}>Monitoreo del sistema</Text>
        </View>
        <Pressable onPress={() => {}} style={styles.iconBtn}>
          <Download size={18} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statsRow}>
          {Object.entries(levelConfig).map(([k, cfg]) => (
            <View key={k} style={styles.statMini}>
              <View style={[styles.statIcon, { backgroundColor: cfg.bg }]}>
                <cfg.Icon size={14} color={cfg.color} />
              </View>
              <Text style={styles.statNum}>{stats[k]}</Text>
              <Text style={styles.statLbl}>{cfg.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.filtersCard}>
          <View style={styles.searchWrap}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar..."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>

          <View style={{ height: 10 }} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
            {['all', 'info', 'warning', 'error', 'success'].map((x) => {
              const active = levelFilter === x;
              return (
                <Pressable
                  key={x}
                  onPress={() => setLevelFilter(x)}
                  style={[styles.pill, active ? styles.pillActive : null]}
                >
                  <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>
                    {x === 'all' ? 'Todos' : levelConfig[x].label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ height: 10 }} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
            <Pressable
              onPress={() => setModuleFilter('all')}
              style={[styles.pill, moduleFilter === 'all' ? styles.pillActive : null]}
            >
              <Text style={[styles.pillText, moduleFilter === 'all' ? styles.pillTextActive : null]}>Módulos</Text>
            </Pressable>
            {modules.map((m) => {
              const active = moduleFilter === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setModuleFilter(m)}
                  style={[styles.pill, active ? styles.pillActive : null]}
                >
                  <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{m}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.listCard}>
          {filtered.map((log) => {
            const cfg = levelConfig[log.level] || levelConfig.info;
            return (
              <Pressable key={log.id} onPress={() => setSelectedLog(log)} style={styles.logRow}>
                <View style={[styles.logIcon, { backgroundColor: cfg.bg }]}>
                  <cfg.Icon size={16} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.logMetaRow}>
                    <Text style={styles.logTime}>{String(log.timestamp).split(' ')[1] || ''}</Text>
                    <View style={styles.logModulePill}>
                      <Text style={styles.logModuleText}>{log.module}</Text>
                    </View>
                    <Text style={[styles.logLevel, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.logMsg}>{log.message}</Text>
                  {log.user ? <Text numberOfLines={1} style={styles.logUser}>{log.user}</Text> : null}
                </View>
              </Pressable>
            );
          })}

          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptyText}>No hay logs para estos filtros.</Text>
            </View>
          ) : null}
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal visible={!!selectedLog} transparent animationType="fade" onRequestClose={() => setSelectedLog(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Detalle del Log</Text>
            <Text style={styles.modalText}>ID: {selectedLog?.id || ''}</Text>

            <View style={{ height: 12 }} />

            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Módulo</Text>
              <Text style={styles.detailVal}>{selectedLog?.module || ''}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Mensaje</Text>
              <Text style={styles.detailVal}>{selectedLog?.message || ''}</Text>
            </View>
            {selectedLog?.user ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Usuario</Text>
                <Text style={styles.detailVal}>{selectedLog.user}</Text>
              </View>
            ) : null}
            {selectedLog?.details ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Detalles</Text>
                <Text style={styles.detailVal}>{selectedLog.details}</Text>
              </View>
            ) : null}

            <View style={{ height: 14 }} />
            <Button fullWidth onPress={() => setSelectedLog(null)}>Cerrar</Button>
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
  iconBtn: { padding: 10, borderRadius: 14, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' },
  headerTitle: { fontWeight: '900', color: '#111827', fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  body: { padding: 16, paddingBottom: 26 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statMini: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 10, alignItems: 'center' },
  statIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
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
  logRow: { padding: 12, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  logIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  logTime: { color: '#6B7280', fontFamily: 'monospace', fontSize: 10 },
  logModulePill: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  logModuleText: { color: '#4B5563', fontSize: 10, fontWeight: '800' },
  logLevel: { fontSize: 10, fontWeight: '900' },
  logMsg: { fontWeight: '900', color: '#111827' },
  logUser: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 22 },
  emptyTitle: { fontWeight: '900', color: '#111827' },
  emptyText: { marginTop: 6, color: '#6B7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 },
  modalTitle: { fontWeight: '900', color: '#111827', fontSize: 18 },
  modalText: { marginTop: 6, color: '#6B7280' },
  detailRow: { marginTop: 10 },
  detailKey: { color: '#6B7280', fontSize: 12 },
  detailVal: { marginTop: 2, color: '#111827', fontWeight: '800' },
});
