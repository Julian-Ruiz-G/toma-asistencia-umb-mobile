import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Eye, FileSpreadsheet } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useAuth } from '../../state/auth';
import { exportAttendanceReport } from '../../utils/reportExport';

export default function ReportActions({ navigation, route }) {
  const { authToken } = useAuth();
  const sessionId = String(route?.params?.sessionId || '').trim();
  const classMeta = route?.params?.classMeta;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('csv');

  const formats = useMemo(() => [
    { v: 'csv', t: 'CSV (.csv)', hint: 'Mismo formato que genera el servidor' },
    { v: 'xlsx', t: 'Excel (.xlsx)', hint: 'Hoja de cálculo a partir del informe' },
    { v: 'pdf', t: 'PDF (.pdf)', hint: 'Tabla lista para imprimir o archivar' },
  ], []);

  const subtitle = useMemo(() => {
    const parts = [];
    if (classMeta?.title) parts.push(classMeta.title);
    if (classMeta?.group) parts.push(`Grupo ${classMeta.group}`);
    return parts.length ? parts.join(' • ') : 'Docente — informe de asistencia';
  }, [classMeta]);

  const handleGenerate = () => {
    if (!sessionId) {
      Alert.alert('Sin sesión', 'Abre el informe desde Mis clases → Informe o Historial.');
      return;
    }
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      navigation.navigate('ReportPreview', {
        sessionId,
        classId: route?.params?.classId,
        classMeta: classMeta || { title: 'Reporte', group: '' },
      });
    }, 400);
  };

  const handleDownload = async () => {
    if (!sessionId) { Alert.alert('Sin sesión', 'Necesitas un sessionId válido.'); return; }
    if (!authToken) { Alert.alert('Sesión', 'Inicia sesión como docente.'); return; }
    setIsDownloading(true);
    try { await exportAttendanceReport(authToken, sessionId, selectedFormat); }
    catch (e) { Alert.alert('Error al exportar', e?.message || String(e)); }
    finally { setIsDownloading(false); }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Acciones del Reporte</Text>
          <Text style={styles.headerSubtitle}>Generar, descargar</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}><FileSpreadsheet size={24} color="#16A34A" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Reporte de Asistencia</Text>
              <Text style={styles.infoSub}>{subtitle}</Text>
              {sessionId
                ? <Text style={styles.sessionHint} numberOfLines={1}>Sesión: {sessionId}</Text>
                : <Text style={styles.sessionWarn}>Sin sessionId — elige una sesión</Text>}
            </View>
          </View>

          <View style={{ height: 14 }} />
          <Button fullWidth isLoading={isGenerating} onPress={handleGenerate}>
            Generar y previsualizar
          </Button>

          <View style={{ height: 10 }} />
          <Text style={styles.label}>Formato de descarga</Text>
          <View style={styles.formatWrap}>
            {formats.map((f) => {
              const active = selectedFormat === f.v;
              return (
                <Pressable key={f.v} onPress={() => setSelectedFormat(f.v)}
                  style={[styles.formatPill, active ? styles.formatPillActive : null]}>
                  <Text style={[styles.formatText, active ? styles.formatTextActive : null]}>{f.t}</Text>
                  <Text style={styles.formatHint}>{f.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: 14 }} />
          <Button fullWidth variant="outline" onPress={handleDownload}
            disabled={isDownloading || !sessionId} isLoading={isDownloading}>
            {`Descargar ${selectedFormat.toUpperCase()}`}
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: '#fff', paddingHorizontal: 24, paddingBottom: 16, paddingTop: 48, flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 12, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: '#6B7280' },
  body: { paddingHorizontal: 24, paddingVertical: 18, paddingBottom: 30 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontWeight: '900', color: '#111827' },
  infoSub: { marginTop: 2, color: '#6B7280' },
  sessionHint: { marginTop: 6, fontSize: 11, color: '#9CA3AF' },
  sessionWarn: { marginTop: 6, fontSize: 12, color: '#B45309', fontWeight: '700' },
  label: { fontWeight: '900', color: '#374151' },
  formatWrap: { marginTop: 10, gap: 10 },
  formatPill: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  formatPillActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(185,28,28,0.06)' },
  formatText: { color: '#4B5563', fontWeight: '800' },
  formatTextActive: { color: COLORS.primary },
  formatHint: { marginTop: 4, fontSize: 11, color: '#9CA3AF' },
});
