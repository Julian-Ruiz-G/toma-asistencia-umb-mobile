import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  FileText,
  History,
  PieChart,
  TrendingUp,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';

export default function ReportsDashboard({ navigation }) {
  const [selectedReportType, setSelectedReportType] = useState('attendance');
  const [dateRange, setDateRange] = useState('week');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [startDate, setStartDate] = useState('2024-04-01');
  const [endDate, setEndDate] = useState('2024-04-30');
  const [isGenerating, setIsGenerating] = useState(false);

  const reportTypes = useMemo(
    () => [
      {
        id: 'attendance',
        label: 'Asistencia Detallada',
        desc: 'Registro completo por estudiante',
        Icon: FileText,
      },
      {
        id: 'summary',
        label: 'Resumen General',
        desc: 'Estadísticas agregadas del grupo',
        Icon: PieChart,
      },
      {
        id: 'trends',
        label: 'Tendencias',
        desc: 'Evolución temporal de asistencia',
        Icon: TrendingUp,
      },
      {
        id: 'comparison',
        label: 'Comparativo',
        desc: 'Comparar grupos o períodos',
        Icon: BarChart3,
      },
    ],
    []
  );

  const subjects = useMemo(
    () => [
      { value: 'all', label: 'Todas las asignaturas' },
      { value: 'calculo', label: 'Cálculo Diferencial' },
      { value: 'fisica', label: 'Física I' },
      { value: 'programacion', label: 'Programación' },
      { value: 'bases', label: 'Base de Datos' },
    ],
    []
  );

  const groups = useMemo(
    () => [
      { value: 'all', label: 'Todos los grupos' },
      { value: 'A', label: 'Grupo A' },
      { value: 'B', label: 'Grupo B' },
      { value: 'C', label: 'Grupo C' },
      { value: 'D', label: 'Grupo D' },
    ],
    []
  );

  const dateRanges = useMemo(
    () => [
      { value: 'today', label: 'Hoy' },
      { value: 'week', label: 'Esta semana' },
      { value: 'month', label: 'Este mes' },
      { value: 'semester', label: 'Este semestre' },
      { value: 'custom', label: 'Personalizado' },
    ],
    []
  );

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      navigation.navigate('ReportPreview', {
        sessionId: '',
        classMeta: { title: 'Consultar informe', group: '' },
      });
    }, 500);
  };

  const SelectPills = ({ label, value, options, onChange }) => {
    return (
      <View style={{ marginTop: 14 }}>
        <Text style={styles.label}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
          {options.map((o) => {
            const active = value === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => onChange(o.value)}
                style={[styles.pill, active ? styles.pillActive : null]}
              >
                <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Generar Reportes</Text>
          <Text style={styles.headerSubtitle}>Configura y genera informes de asistencia</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('ReportHistory')} style={styles.iconBtn}>
          <History size={20} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionTitle}>Tipo de Reporte</Text>
        <View style={styles.grid2}>
          {reportTypes.map((t) => {
            const active = selectedReportType === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setSelectedReportType(t.id)}
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

        <SelectPills
          label="Rango de fechas"
          value={dateRange}
          options={dateRanges}
          onChange={(v) => setDateRange(v)}
        />

        {dateRange === 'custom' ? (
          <View style={styles.customDates}>
            <View style={styles.dateChip}>
              <Calendar size={16} color={COLORS.primary} />
              <View>
                <Text style={styles.dateChipLabel}>Inicio</Text>
                <Text style={styles.dateChipValue}>{startDate}</Text>
              </View>
            </View>
            <View style={styles.dateChip}>
              <Calendar size={16} color={COLORS.primary} />
              <View>
                <Text style={styles.dateChipLabel}>Fin</Text>
                <Text style={styles.dateChipValue}>{endDate}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <SelectPills
          label="Asignatura"
          value={selectedSubject}
          options={subjects}
          onChange={(v) => setSelectedSubject(v)}
        />

        <SelectPills
          label="Grupo"
          value={selectedGroup}
          options={groups}
          onChange={(v) => setSelectedGroup(v)}
        />

        <View style={{ height: 16 }} />
        <Button fullWidth size="lg" isLoading={isGenerating} onPress={handleGenerate}>
          Generar
        </Button>

        <View style={{ height: 18 }} />
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
  label: { marginTop: 14, marginBottom: 10, color: '#374151', fontWeight: '900' },
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
  typeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  typeIconActive: { backgroundColor: 'rgba(185,28,28,0.10)' },
  typeTitle: { fontWeight: '900', color: '#111827' },
  typeDesc: { marginTop: 4, color: '#6B7280', fontSize: 12, lineHeight: 16 },
  pillsRow: { gap: 10 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: '#6B7280', fontWeight: '800' },
  pillTextActive: { color: '#fff' },
  customDates: { marginTop: 12, flexDirection: 'row', gap: 12 },
  dateChip: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', gap: 10, alignItems: 'center' },
  dateChipLabel: { color: '#9CA3AF', fontSize: 12 },
  dateChipValue: { marginTop: 2, fontWeight: '900', color: '#111827' },
});
