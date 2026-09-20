import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Camera, Clock, QrCode, ShieldCheck, Users } from 'lucide-react-native';

import { COLORS } from '../../ui/theme';
import Animated, { enterDown } from '../../ui/motion';

const STEPS = [
  {
    n: '1',
    Icon: QrCode,
    color: '#EF4444',
    bg: '#FEF2F2',
    title: 'QR de asistencia',
    text: 'En el horario de la clase (desde 15 minutos antes hasta la hora de fin), pulsa Ver QR. Los estudiantes lo escanean para marcar presencia. Fuera de ese bloque el QR no se crea.',
  },
  {
    n: '2',
    Icon: Camera,
    color: '#7C3AED',
    bg: '#F3E8FF',
    title: 'Foto de la clase',
    text: 'Durante la misma ventana toma 1 o 2 fotos del salón. El sistema reconoce rostros inscritos y marca asistencia. También aplica solo el día y la hora programados.',
  },
  {
    n: '3',
    Icon: Users,
    color: '#0284C7',
    bg: '#E0F2FE',
    title: 'Tablero en vivo',
    text: 'En Asistencia ves quién ya marcó, retardos y ausencias. Puedes corregir a mano solo mientras dura el bloque de clase.',
  },
];

const RULES = [
  'La foto y el QR de asistencia no se usan si hoy esa materia no está en el horario.',
  'Hay 15 minutos de anticipación: puedes abrir QR y foto un poco antes de la hora de inicio.',
  'Cuando termina la hora de fin, cierra el ciclo: historial e informe.',
  'El QR de inscripción (en el detalle de la clase) sí sirve cualquier día: es para que el estudiante se una al curso, no para marcar asistencia.',
];

export default function TeacherAttendanceGuide({ navigation }) {
  return (
    <View style={styles.root}>
      <Animated.View entering={enterDown(0, 360)} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Cómo tomar asistencia</Text>
          <Text style={styles.headerSubtitle}>QR, foto y reglas del horario</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body}>
        {STEPS.map((s) => (
          <Animated.View key={s.n} entering={enterDown(Number(s.n) * 60)} style={styles.card}>
            <View style={[styles.badge, { backgroundColor: s.bg }]}>
              <s.Icon size={22} color={s.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepN}>Paso {s.n}</Text>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          </Animated.View>
        ))}

        <Animated.View entering={enterDown(260)} style={styles.rules}>
          <View style={styles.rulesHead}>
            <ShieldCheck size={18} color={COLORS.primary} />
            <Text style={styles.rulesTitle}>Reglas que debes seguir</Text>
          </View>
          {RULES.map((r) => (
            <View key={r} style={styles.ruleRow}>
              <Clock size={14} color={COLORS.primary} />
              <Text style={styles.ruleText}>{r}</Text>
            </View>
          ))}
        </Animated.View>
        <View style={{ height: 28 }} />
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: '#6B7280' },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepN: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase' },
  stepTitle: { marginTop: 2, fontWeight: '900', fontSize: 16, color: '#111827' },
  stepText: { marginTop: 6, color: '#4B5563', lineHeight: 20, fontSize: 13 },
  rules: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rulesHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rulesTitle: { fontWeight: '900', color: '#111827', fontSize: 15 },
  ruleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  ruleText: { flex: 1, color: '#374151', fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
