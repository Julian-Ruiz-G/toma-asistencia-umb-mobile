import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';

const mockHistory = [
  { id: '1', name: 'estudiantes_2024.csv', date: '2024-01-15', records: 1250, status: 'success' },
  { id: '2', name: 'docentes_nuevos.xlsx', date: '2024-01-14', records: 45, status: 'success' },
  { id: '3', name: 'asignaturas_semestre.xlsx', date: '2024-01-13', records: 0, status: 'error' },
];

export default function CargaMasivaPage({ navigation }) {
  const [files, setFiles] = useState([]);
  const [uploadType, setUploadType] = useState('estudiantes');

  const types = useMemo(() => ['estudiantes', 'docentes', 'asignaturas', 'notas'], []);

  const addMockFile = () => {
    setFiles((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: `${uploadType}_demo.xlsx`,
        size: 1024 * 1024 * 0.4,
        type: uploadType,
        status: 'pending',
        progress: 0,
      },
    ]);
  };

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#4B5563" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Carga Masiva</Text>
          <Text style={styles.headerSubtitle}>Importa datos desde CSV o Excel</Text>
        </View>
        <Pressable onPress={() => {}} style={styles.iconBtn}>
          <Download size={18} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>Tipo de datos</Text>
          <View style={styles.typeGrid}>
            {types.map((t) => {
              const active = uploadType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setUploadType(t)}
                  style={[styles.typePill, active ? styles.typePillActive : null]}
                >
                  <Text style={[styles.typeText, active ? styles.typeTextActive : null]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: 12 }} />

          <View style={styles.dropZone}>
            <View style={styles.dropIcon}>
              <Upload size={24} color="#9CA3AF" />
            </View>
            <Text style={styles.dropTitle}>Arrastra archivos aquí</Text>
            <Text style={styles.dropSub}>CSV, Excel (.xlsx, .xls)</Text>
            <View style={{ height: 10 }} />
            <Button fullWidth onPress={addMockFile}>Seleccionar</Button>
          </View>
        </View>

        {files.length > 0 ? (
          <View style={[styles.card, { marginTop: 12, padding: 0, overflow: 'hidden' }]}>
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>Archivos ({files.length})</Text>
            </View>

            {files.map((f) => (
              <View key={f.id} style={styles.fileRow}>
                <View style={styles.fileIcon}>
                  <FileSpreadsheet size={18} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName}>{f.name}</Text>
                  <Text style={styles.fileMeta}>{formatSize(f.size)}</Text>
                </View>
                <Pressable onPress={() => removeFile(f.id)} style={styles.removeBtn}>
                  <X size={16} color="#9CA3AF" />
                </Pressable>
              </View>
            ))}

            <View style={styles.listFooter}>
              <Button fullWidth onPress={() => Alert.alert('Mock', 'Iniciar carga')}>Iniciar carga</Button>
            </View>
          </View>
        ) : null}

        <View style={[styles.card, { marginTop: 12, padding: 0, overflow: 'hidden' }]}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>Historial</Text>
          </View>
          {mockHistory.map((h) => (
            <View key={h.id} style={styles.fileRow}>
              <View style={[styles.fileIcon, { backgroundColor: h.status === 'success' ? '#DCFCE7' : '#FEE2E2' }]}>
                {h.status === 'success' ? (
                  <CheckCircle size={18} color="#16A34A" />
                ) : (
                  <AlertCircle size={18} color="#DC2626" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName}>{h.name}</Text>
                <Text style={styles.fileMeta}>{h.date} • {h.status === 'success' ? `${h.records} registros` : 'Error'}</Text>
              </View>
              <Pressable onPress={() => {}} style={styles.removeBtn}>
                <Download size={16} color="#9CA3AF" />
              </Pressable>
            </View>
          ))}
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
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
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 14 },
  label: { fontWeight: '900', color: '#374151' },
  typeGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typePill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  typePillActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(185,28,28,0.06)' },
  typeText: { fontWeight: '900', color: '#6B7280', textTransform: 'capitalize' },
  typeTextActive: { color: COLORS.primary },
  dropZone: { borderWidth: 2, borderColor: '#D1D5DB', borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center' },
  dropIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  dropTitle: { marginTop: 10, fontWeight: '900', color: '#374151' },
  dropSub: { marginTop: 6, color: '#6B7280', fontSize: 12 },
  listHeader: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  listHeaderText: { fontWeight: '900', color: '#111827' },
  fileRow: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  fileIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  fileName: { fontWeight: '900', color: '#111827' },
  fileMeta: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  removeBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6' },
  listFooter: { padding: 12 },
});
