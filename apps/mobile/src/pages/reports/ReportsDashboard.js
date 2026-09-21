import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  PieChart,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import Animated, { enterDown, listEnter } from '../../ui/motion';
import { useAuth } from '../../state/auth';
import { MY_CLASSES_URL } from '../../config';

export default function ReportsDashboard({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken } = useAuth();
  const [reportType, setReportType] = useState('session');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [corte, setCorte] = useState('1');

  const reportTypes = useMemo(
    () => [
      {
        id: 'session',
        label: 'Por sesión',
        desc: 'Lista de fechas. Eliges un día y ves quién asistió, quién llegó tarde y quién faltó.',
        Icon: FileText,
      },
      {
        id: 'summary',
        label: 'Resumen general',
        desc: 'Totales de la materia: presentes, retardos y ausencias de todo el corte.',
        Icon: PieChart,
      },
      {
        id: 'detail',
        label: 'Detalle completo',
        desc: 'Una fila por estudiante y por sesión, lista para Excel o PDF.',
        Icon: FileSpreadsheet,
      },
      {
        id: 'corte',
        label: 'Por corte',
        desc: 'Informe filtrado por corte 1 o 2, según el calendario de la UMB.',
        Icon: Layers,
      },
    ],
    []
  );

  const loadClasses = useCallback(async () => {
    if (!MY_CLASSES_URL || !authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(MY_CLASSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        throw new Error((json && (json.error || json.message)) || text || `HTTP ${resp.status}`);
      }
      const arr = Array.isArray(json?.classes) ? json.classes : [];
      setClasses(arr);
      setSelectedClassId((prev) => prev || String(arr[0]?.classId || ''));
    } catch (e) {
      appAlert('Error', e?.message || String(e));
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const selectedClass = classes.find((c) => String(c.classId) === String(selectedClassId));

  const classMeta = {
    title: selectedClass?.className || selectedClass?.name || 'Clase',
    group: selectedClass?.group || '',
  };

  const handleGenerate = () => {
    if (!selectedClassId) {
      appAlert('Elige una clase', 'Selecciona una de tus clases para generar el informe.');
      return;
    }
    setGenerating(true);
    try {
      if (reportType === 'session') {
        navigation.navigate('InformeSessionsList', {
          classId: selectedClassId,
          className: classMeta.title,
          group: classMeta.group,
        });
        return;
      }
      navigation.navigate('ReportPreview', {
        classId: selectedClassId,
        mode: reportType === 'corte' ? 'detail' : reportType,
        corte: reportType === 'corte' ? corte : undefined,
        classMeta,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={enterDown(0, 360)} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Reportes</Text>
          <Text style={styles.headerSubtitle}>Informes reales de tus clases</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('ReportHistory')} style={styles.iconBtn}>
          <History size={20} color={COLORS.icon} />
        </Pressable>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionTitle}>Tipo de informe</Text>
        <View style={styles.grid2}>
          {reportTypes.map((t, idx) => {
            const active = reportType === t.id;
            return (
              <Animated.View key={t.id} entering={listEnter(idx)} style={{ width: '48%' }}>
              <Pressable
                onPress={() => setReportType(t.id)}
                style={[styles.typeCard, active ? styles.typeCardActive : null]}
              >
                <View style={[styles.typeIcon, active ? styles.typeIconActive : null]}>
                  <t.Icon size={18} color={active ? COLORS.primary : COLORS.muted} />
                </View>
                <Text style={styles.typeTitle}>{t.label}</Text>
                <Text style={styles.typeDesc}>{t.desc}</Text>
              </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Tu clase</Text>
        {loading ? (
          <View style={styles.centerMini}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.muted}>Cargando clases…</Text>
          </View>
        ) : classes.length === 0 ? (
          <Text style={styles.muted}>Aún no tienes clases. Créala desde el inicio del docente.</Text>
        ) : (
          classes.map((c) => {
            const id = String(c.classId || '');
            const active = id === String(selectedClassId);
            return (
              <Pressable
                key={id}
                onPress={() => setSelectedClassId(id)}
                style={[styles.classRow, active ? styles.classRowActive : null]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.classTitle}>{c.className || c.name || 'Clase'}</Text>
                  <Text style={styles.classSub}>
                    {c.group ? `Grupo ${c.group}` : 'Sin grupo'}
                    {c.studentsCount != null ? ` • ${c.studentsCount} estudiantes` : ''}
                  </Text>
                </View>
                <View style={[styles.radio, active ? styles.radioOn : null]} />
              </Pressable>
            );
          })
        )}

        {reportType === 'corte' ? (
          <View>
            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Corte</Text>
            <View style={styles.corteRow}>
              {['1', '2'].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setCorte(n)}
                  style={[styles.corteChip, corte === n ? styles.corteChipOn : null]}
                >
                  <Text style={[styles.corteText, corte === n ? styles.corteTextOn : null]}>Corte {n}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.hint}>
          El informe se abre en pantalla y ahí puedes exportarlo a CSV, Excel o PDF. El historial (icono de arriba) lista sesiones previas.
        </Text>
        <View style={{ height: 18 }} />
        <Button fullWidth size="lg" isLoading={generating || loading} onPress={handleGenerate}>
          {reportType === 'session' ? 'Ver sesiones' : 'Generar informe'}
        </Button>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 12, borderRadius: 999 },
  iconBtn: { padding: 10, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: COLORS.muted },
  body: { paddingHorizontal: 24, paddingVertical: 18, paddingBottom: 30 },
  sectionTitle: { fontWeight: '900', color: COLORS.textSecondary },
  grid2: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  typeCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  typeCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  typeIconActive: { backgroundColor: COLORS.primarySoft },
  typeTitle: { fontWeight: '900', color: COLORS.text },
  typeDesc: { marginTop: 4, color: COLORS.muted, fontSize: 12, lineHeight: 16 },
  classRow: {
    marginTop: 10,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  classRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  classTitle: { fontWeight: '800', color: COLORS.text },
  classSub: { marginTop: 4, color: COLORS.muted, fontSize: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.border },
  radioOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  corteRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  corteChip: {
    flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  corteChipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  corteText: { fontWeight: '800', color: COLORS.icon },
  corteTextOn: { color: COLORS.primary },
  hint: { marginTop: 16, color: COLORS.muted, fontSize: 12, lineHeight: 17 },
  centerMini: { paddingVertical: 20, alignItems: 'center' },
  muted: { marginTop: 10, color: COLORS.muted },
});
