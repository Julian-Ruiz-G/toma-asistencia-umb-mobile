import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  FileSpreadsheet,
  Search,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useAuth } from '../../state/auth';
import { CLASS_DETAILS_URL, MY_CLASSES_URL } from '../../config';

export default function ReportHistory({ navigation }) {
  const { authToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!authToken || !MY_CLASSES_URL || !CLASS_DETAILS_URL) {
      setLoading(false);
      setError('Falta configuración de API o sesión');
      return;
    }
    setError('');
    try {
      const classResp = await fetch(MY_CLASSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });
      const classText = await classResp.text();
      let classJson;
      try { classJson = JSON.parse(classText); } catch { classJson = null; }
      if (!classResp.ok) {
        throw new Error((classJson && (classJson.error || classJson.message)) || classText);
      }
      const classes = Array.isArray(classJson?.classes) ? classJson.classes : [];
      const out = [];
      for (const c of classes) {
        const classId = String(c.classId || '').trim();
        if (!classId) continue;
        const detResp = await fetch(CLASS_DETAILS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ classId }),
        });
        const detText = await detResp.text();
        let detJson;
        try { detJson = JSON.parse(detText); } catch { detJson = null; }
        if (!detResp.ok) continue;
        const sessions = Array.isArray(detJson?.attendanceSessions) ? detJson.attendanceSessions : [];
        const classMeta = {
          title: c.className || c.name || 'Clase',
          group: c.group || '',
        };
        out.push({
          key: `class-${classId}`,
          kind: 'class',
          classId,
          sessionId: '',
          title: `Resumen • ${classMeta.title}`,
          subtitle: classMeta.group ? `Grupo ${classMeta.group}` : 'Toda la clase',
          dateLabel: `${sessions.length} sesiones`,
          classMeta,
        });
        sessions.forEach((s) => {
          const sid = String(s.sessionId || '').trim();
          if (!sid) return;
          out.push({
            key: sid,
            kind: 'session',
            classId,
            sessionId: sid,
            title: classMeta.title,
            subtitle: classMeta.group ? `Grupo ${classMeta.group}` : '',
            dateLabel: String(s.sessionDate || sid),
            classMeta,
          });
        });
      }
      setRows(out);
    } catch (e) {
      setError(e?.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.title} ${r.subtitle} ${r.dateLabel}`.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const openRow = (r) => {
    if (r.kind === 'class') {
      navigation.navigate('ReportPreview', {
        classId: r.classId,
        mode: 'summary',
        classMeta: r.classMeta,
      });
      return;
    }
    navigation.navigate('ReportPreview', {
      sessionId: r.sessionId,
      classId: r.classId,
      classMeta: r.classMeta,
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Historial</Text>
          <Text style={styles.headerSubtitle}>Sesiones e informes de tus clases</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>Cargando informes…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
          <Pressable onPress={() => { setLoading(true); load(); }} style={styles.retry}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
        >
          <View style={styles.searchWrap}>
            <Search size={18} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar clase o sesión..."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>

          {filtered.map((r) => (
            <Pressable key={r.key} onPress={() => openRow(r)} style={styles.item}>
              <View style={styles.fileIcon}>
                {r.kind === 'class' ? (
                  <FileSpreadsheet size={20} color="#16A34A" />
                ) : (
                  <Calendar size={20} color={COLORS.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{r.title}</Text>
                <Text style={styles.itemSub}>
                  {r.subtitle ? `${r.subtitle} • ` : ''}
                  {r.dateLabel}
                </Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </Pressable>
          ))}

          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Sin informes</Text>
              <Text style={styles.emptyText}>Cuando existan sesiones de asistencia, aparecerán aquí.</Text>
            </View>
          ) : null}

          <View style={{ height: 18 }} />
          <Button fullWidth variant="outline" onPress={() => navigation.goBack()}>
            Volver
          </Button>
          <View style={{ height: 18 }} />
        </ScrollView>
      )}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { marginTop: 10, color: '#6B7280' },
  err: { color: '#B91C1C', textAlign: 'center', fontWeight: '700' },
  retry: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '800' },
  searchWrap: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: '#111827' },
  item: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { fontWeight: '900', color: '#111827' },
  itemSub: { marginTop: 4, color: '#6B7280', fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 30 },
  emptyTitle: { fontWeight: '900', color: '#111827' },
  emptyText: { marginTop: 6, color: '#6B7280', textAlign: 'center' },
});
