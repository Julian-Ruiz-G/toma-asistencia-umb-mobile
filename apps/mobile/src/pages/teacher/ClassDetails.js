import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, BookOpen, Clock, Pencil, QrCode, Users } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import Animated, { enterDown, listEnter } from '../../ui/motion';
import { CLASS_DETAILS_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { classStatusMeta, formatScheduleLines } from '../../utils/schedule';
import { personDisplayName } from '../../utils/displayName';

export default function ClassDetails({ navigation, route }) {
  const { authToken } = useAuth();
  const classId = route?.params?.classId;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!CLASS_DETAILS_URL || !authToken || !classId) return;
    setLoading(true);
    try {
      const resp = await fetch(CLASS_DETAILS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ classId }),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        throw new Error((json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`);
      }
      setDetails(json);
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [authToken, classId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const c = details?.class || {};
  const students = Array.isArray(details?.students) ? details.students : [];
  const lines = useMemo(() => formatScheduleLines(c?.schedule || []), [c?.schedule]);
  const status = classStatusMeta(c);
  const classToken = c?.classToken || details?.classToken || details?.token || '';
  const title = c?.className || 'Clase';

  return (
    <View style={styles.root}>
      <Animated.View entering={enterDown(0, 360)} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Detalle de clase</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{loading ? 'Cargando…' : title}</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('TeacherCreateClass', { classId })}
          style={styles.iconBtn}
        >
          <Pencil size={18} color={COLORS.primary} />
        </Pressable>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body}>
        <Animated.View entering={enterDown(40)} style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>
              <BookOpen size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.className}>{title}</Text>
              <Text style={styles.classMeta}>{c?.group ? `Grupo ${c.group}` : 'Sin grupo'}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: status.pillBg, borderColor: status.pillBorder }]}>
              <Text style={[styles.pillText, { color: status.pillText }]}>{status.label}</Text>
            </View>
          </View>
          {c?.subjectCode ? <Text style={styles.metaLine}>Código: {c.subjectCode}</Text> : null}
          {c?.period ? <Text style={styles.metaLine}>Periodo: {c.period}</Text> : null}
        </Animated.View>

        <Animated.View entering={enterDown(80)} style={styles.card}>
          <View style={styles.sectionHead}>
            <Clock size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Horario</Text>
          </View>
          {lines.length ? lines.map((line, idx) => (
            <View key={`${line}-${idx}`} style={styles.scheduleRow}>
              <Text style={styles.scheduleText}>{line}</Text>
            </View>
          )) : (
            <Text style={styles.muted}>Esta clase aún no tiene horario asignado.</Text>
          )}
        </Animated.View>

        <Animated.View entering={enterDown(120)} style={styles.card}>
          <View style={styles.sectionHead}>
            <Users size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Estudiantes inscritos</Text>
            <Text style={styles.count}>{students.length}</Text>
          </View>
          {students.length ? students.map((s, idx) => (
            <Animated.View key={s.studentEmail || idx} entering={listEnter(idx)} style={styles.studentRow}>
              <View style={styles.studentDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{personDisplayName(s.studentName, 'Estudiante')}</Text>
                {s.studentEmail ? <Text style={styles.studentCode}>{s.studentEmail}</Text> : null}
                {s.studentCode ? <Text style={styles.studentCode}>Código {s.studentCode}</Text> : null}
              </View>
            </Animated.View>
          )) : (
            <Text style={styles.muted}>{loading ? 'Cargando…' : 'Aún no hay estudiantes inscritos.'}</Text>
          )}
        </Animated.View>

        {classToken ? (
          <Animated.View entering={enterDown(160)} style={styles.card}>
            <View style={styles.sectionHead}>
              <QrCode size={16} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>QR de inscripción</Text>
            </View>
            <Text style={styles.muted}>Los estudiantes lo escanean para unirse a la clase.</Text>
            <View style={{ alignItems: 'center', marginTop: 14 }}>
              <QRCode value={String(classToken)} size={200} />
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={enterDown(200)}>
          <Button fullWidth onPress={() => navigation.navigate('TeacherCreateClass', { classId })}>
            Editar clase
          </Button>
          <View style={{ height: 10 }} />
          <Button
            fullWidth
            variant="outline"
            onPress={() => navigation.navigate('SessionHistory', {
              classId,
              className: title,
              group: c?.group || '',
            })}
          >
            Ver historial
          </Button>
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
  iconBtn: { padding: 10, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: '#6B7280' },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleIcon: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(185,28,28,0.10)', alignItems: 'center', justifyContent: 'center',
  },
  className: { fontWeight: '900', color: '#111827', fontSize: 16 },
  classMeta: { marginTop: 2, color: '#6B7280' },
  metaLine: { marginTop: 10, color: '#4B5563', fontWeight: '700', fontSize: 13 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontWeight: '900', color: '#111827', flex: 1 },
  count: { fontWeight: '900', color: COLORS.primary },
  scheduleRow: {
    backgroundColor: '#F9FAFB', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
  },
  scheduleText: { color: '#374151', fontWeight: '700' },
  muted: { color: '#6B7280' },
  studentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  studentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6 },
  studentName: { fontWeight: '800', color: '#111827' },
  studentCode: { marginTop: 2, color: '#6B7280', fontSize: 12 },
});
