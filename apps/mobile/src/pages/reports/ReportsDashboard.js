import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  History,
  PieChart,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useAuth } from '../../state/auth';
import { MY_CLASSES_URL } from '../../config';

export default function ReportsDashboard({ navigation }) {
  const { authToken } = useAuth();
  const [reportType, setReportType] = useState('session');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const reportTypes = useMemo(
    () => [
      {
        id: 'session',
        label: 'Por sesión',
        desc: 'Elige una fecha/sesión de la clase',
        Icon: FileText,
      },
      {
        id: 'summary',
        label: 'Resumen general',
        desc: 'Totales de asistencia de toda la clase',
        Icon: PieChart,
      },
      {
        id: 'detail',
        label: 'Detalle completo',
        desc: 'Una fila por estudiante y sesión',
        Icon: FileSpreadsheet,
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
      Alert.alert('Error', e?.message || String(e));
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
      Alert.alert('Elige una clase', 'Selecciona una de tus clases para generar el informe.');
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
        mode: reportType,
        classMeta,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Reportes</Text>
          <Text style={styles.headerSubtitle}>Informes reales de tus clases</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('ReportHistory')} style={styles.iconBtn}>
          <History size={20} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionTitle}>Tipo de informe</Text>
        <View style={styles.grid2}>
          {reportTypes.map((t) => {
            const active = reportType === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setReportType(t.id)}
                style={[styles.typeCard, active ? styles.typeCardActive : null]}
              >
                <View style={[styles.typeIcon, active ? styles.typeIconActive : null]}>
                  <t.Icon size={18} color={active ? COLORS.primary : '#6B7280'} />
                </View>
                <Text style={styles.typeTitle}>{t.label}</Text>
                <Text style={styles.typeDesc}>{t.desc}</Text>
              </Pressable>
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

        <View style={{ height: 18 }} />
        <Button fullWidth size="lg" isLoading={generating || loading} onPress={handleGenerate}>
          Generar
        </Button>
        <View style={{ height: 24 }} />
      </ScrollView>
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
  iconBtn: { padding: 10, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: '#6B7280' },
  body: { paddingHorizontal: 24, paddingVertical: 18, paddingBottom: 30 },
  sectionTitle: { fontWeight: '900', color: '#374151' },
  grid2: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  typeCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  typeCardActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(185,28,28,0.05)' },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  typeIconActive: { backgroundColor: 'rgba(185,28,28,0.10)' },
  typeTitle: { fontWeight: '900', color: '#111827' },
  typeDesc: { marginTop: 4, color: '#6B7280', fontSize: 12, lineHeight: 16 },
  classRow: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  classRowActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(185,28,28,0.04)' },
  classTitle: { fontWeight: '800', color: '#111827' },
  classSub: { marginTop: 4, color: '#6B7280', fontSize: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB' },
  radioOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  centerMini: { paddingVertical: 20, alignItems: 'center' },
  muted: { marginTop: 10, color: '#6B7280' },
});
