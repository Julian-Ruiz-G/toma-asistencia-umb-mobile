import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
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
import { useColors } from '../../ui/ThemeContext';

const mockHistory = [
  { id: '1', name: 'estudiantes_2024.csv', date: '2024-01-15', records: 1250, status: 'success' },
  { id: '2', name: 'docentes_nuevos.xlsx', date: '2024-01-14', records: 45, status: 'success' },
  { id: '3', name: 'asignaturas_semestre.xlsx', date: '2024-01-13', records: 0, status: 'error' },
];

export default function CargaMasivaPage({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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
          <ArrowLeft size={20} color={COLORS.icon} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Carga Masiva</Text>
          <Text style={styles.headerSubtitle}>Importa datos desde CSV o Excel</Text>
        </View>
        <Pressable onPress={() => {}} style={styles.iconBtn}>
          <Download size={18} color={COLORS.icon} />
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
              <Upload size={24} color={COLORS.placeholder} />
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
                  <FileSpreadsheet size={18} color={COLORS.successStrong} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName}>{f.name}</Text>
                  <Text style={styles.fileMeta}>{formatSize(f.size)}</Text>
                </View>
                <Pressable onPress={() => removeFile(f.id)} style={styles.removeBtn}>
                  <X size={16} color={COLORS.placeholder} />
                </Pressable>
              </View>
            ))}

            <View style={styles.listFooter}>
              <Button fullWidth onPress={() => appAlert('Carga masiva', 'Esta función de prueba aún no inicia una carga real.')}>Iniciar carga</Button>
            </View>
          </View>
        ) : null}

        <View style={[styles.card, { marginTop: 12, padding: 0, overflow: 'hidden' }]}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>Historial</Text>
          </View>
          {mockHistory.map((h) => (
            <View key={h.id} style={styles.fileRow}>
              <View style={[styles.fileIcon, { backgroundColor: h.status === 'success' ? COLORS.successBg : COLORS.dangerBg }]}>
                {h.status === 'success' ? (
                  <CheckCircle size={18} color={COLORS.successStrong} />
                ) : (
                  <AlertCircle size={18} color={COLORS.dangerStrong} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName}>{h.name}</Text>
                <Text style={styles.fileMeta}>{h.date} • {h.status === 'success' ? `${h.records} registros` : 'Error'}</Text>
              </View>
              <Pressable onPress={() => {}} style={styles.removeBtn}>
                <Download size={16} color={COLORS.placeholder} />
              </Pressable>
            </View>
          ))}
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
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
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  label: { fontWeight: '900', color: COLORS.textSecondary },
  typeGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typePill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  typePillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  typeText: { fontWeight: '900', color: COLORS.muted, textTransform: 'capitalize' },
  typeTextActive: { color: COLORS.primary },
  dropZone: { borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center' },
  dropIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  dropTitle: { marginTop: 10, fontWeight: '900', color: COLORS.textSecondary },
  dropSub: { marginTop: 6, color: COLORS.muted, fontSize: 12 },
  listHeader: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listHeaderText: { fontWeight: '900', color: COLORS.text },
  fileRow: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  fileIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.successBg, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontWeight: '900', color: COLORS.text },
  fileMeta: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  removeBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  listFooter: { padding: 12 },
});
