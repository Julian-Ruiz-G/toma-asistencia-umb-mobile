import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, BookOpen, ChevronRight, Clock, Palette, User, Users } from 'lucide-react-native';

import OverlayDismiss from '../../components/OverlayDismiss';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import Animated, { enterDown, listEnter } from '../../ui/motion';
import { CLASS_DETAILS_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { personDisplayName } from '../../utils/displayName';
import { CLASS_COLOR_OPTIONS, hexToRgba, loadClassColor, resolveClassColor, saveClassColor } from '../../utils/classColors';

const DAY_LABEL = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

function scheduleLines(schedule) {
  if (!Array.isArray(schedule) || !schedule.length) return [];
  return schedule.map((s) => {
    const day = DAY_LABEL[String(s?.day || '').toUpperCase()] || String(s?.day || '');
    const start = String(s?.startTime || '');
    const end = String(s?.endTime || '');
    const hours = start && end ? `${start} – ${end}` : start || end;
    return [day, hours].filter(Boolean).join(' · ');
  }).filter(Boolean);
}

export default function StudentClassDetails({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken, email } = useAuth();
  const classId = route?.params?.classId;
  const preview = route?.params?.classPreview || {};
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [classColor, setClassColor] = useState(COLORS.primary);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!CLASS_DETAILS_URL) {
      appAlert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }
    if (!authToken) {
      appAlert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return;
    }
    if (!classId) {
      appAlert('Error', 'No se encontró la clase.');
      return;
    }
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
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (!resp.ok) {
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      setDetails(json);
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [authToken, classId]);

  useFocusEffect(
    useCallback(() => {
      load();
      let cancelled = false;
      (async () => {
        const saved = await loadClassColor(email, classId);
        if (!cancelled) setClassColor(saved);
      })();
      return () => {
        cancelled = true;
      };
    }, [load, email, classId])
  );

  const c = details?.class || preview;
  const me = String(email || '').trim().toLowerCase();
  const classmates = (Array.isArray(details?.students) ? details.students : [])
    .filter((s) => !s?.isSelf && String(s?.studentEmail || '').trim().toLowerCase() !== me);
  const lines = useMemo(
    () => scheduleLines(c?.schedule || preview?.schedule || []),
    [c?.schedule, preview?.schedule]
  );
  const title = c?.className || preview?.className || preview?.subject || 'Clase';
  const group = c?.group || preview?.group || '';
  const teacherName = personDisplayName(c?.teacherName, '');
  const accent = resolveClassColor(classColor);

  const pickColor = async (hex) => {
    const next = resolveClassColor(hex);
    setClassColor(next);
    setColorMenuOpen(false);
    await saveClassColor(email, classId, next);
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={enterDown(0, 360)} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Detalle de clase</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{title}</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body}>
        <Animated.View entering={enterDown(40)} style={styles.card}>
          <View style={styles.titleRow}>
            <View style={[styles.titleIcon, { backgroundColor: hexToRgba(accent, 0.14) }]}>
              <BookOpen size={18} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.className}>{title}</Text>
              {group ? <Text style={styles.classMeta}>Grupo {group}</Text> : null}
            </View>
          </View>

          {c?.subjectCode ? (
            <Text style={styles.metaLine}>Código: {c.subjectCode}</Text>
          ) : null}
          {c?.period ? (
            <Text style={styles.metaLine}>Corte: {String(c.period) === '2' ? '2' : '1'}</Text>
          ) : (
            <Text style={styles.metaLine}>Corte: 1</Text>
          )}

          {teacherName ? (
            <View style={styles.infoBlock}>
              <User size={16} color={COLORS.muted} />
              <Text style={styles.infoText}>{teacherName}</Text>
            </View>
          ) : null}

          <Pressable onPress={() => setColorMenuOpen(true)} style={styles.colorBtn}>
            <View style={[styles.colorPreview, { backgroundColor: accent }]} />
            <Text style={styles.colorLabel}>Color de la materia</Text>
            <ChevronRight size={18} color={COLORS.placeholder} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={enterDown(80)} style={styles.card}>
          <View style={styles.sectionHead}>
            <Clock size={16} color={COLORS.icon} />
            <Text style={styles.sectionTitle}>Horario</Text>
          </View>
          {lines.length ? lines.map((line, idx) => (
            <View key={`${line}-${idx}`} style={styles.scheduleRow}>
              <Text style={styles.scheduleText}>{line}</Text>
            </View>
          )) : (
            <Text style={styles.muted}>Esta clase aún no tiene horario.</Text>
          )}
        </Animated.View>

        <Animated.View entering={enterDown(120)} style={styles.card}>
          <View style={styles.sectionHead}>
            <Users size={16} color={COLORS.icon} />
            <Text style={styles.sectionTitle}>Compañeros</Text>
            <Text style={styles.count}>{classmates.length || '—'}</Text>
          </View>
          {classmates.length ? classmates.map((s, idx) => (
            <Animated.View key={`${s.studentName || 'est'}-${idx}`} entering={listEnter(idx)} style={styles.studentRow}>
              <View style={styles.studentDot} />
              <Text style={styles.studentName}>{personDisplayName(s.studentName, 'Estudiante')}</Text>
            </Animated.View>
          )) : (
            <Text style={styles.muted}>{loading ? 'Cargando…' : 'Aún no hay otros estudiantes inscritos.'}</Text>
          )}
        </Animated.View>
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal
        visible={colorMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setColorMenuOpen(false)}
      >
        <OverlayDismiss style={styles.menuOverlay} onClose={() => setColorMenuOpen(false)}>
          <View style={styles.menuCard}>
            <View style={styles.menuHead}>
              <Palette size={18} color={COLORS.icon} />
              <Text style={styles.menuTitle}>Color de la materia</Text>
            </View>
            <View style={styles.swatchRow}>
              {CLASS_COLOR_OPTIONS.map((hex) => {
                const selected = resolveClassColor(hex) === accent;
                return (
                  <Pressable
                    key={hex}
                    onPress={() => pickColor(hex)}
                    style={[
                      styles.swatch,
                      { backgroundColor: hex },
                      selected ? styles.swatchOn : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Color ${hex}`}
                  />
                );
              })}
            </View>
          </View>
        </OverlayDismiss>
      </Modal>
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: COLORS.muted },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  className: { fontWeight: '900', color: COLORS.text, fontSize: 16 },
  classMeta: { marginTop: 2, color: COLORS.muted },
  metaLine: { marginTop: 10, color: COLORS.icon, fontWeight: '700', fontSize: 13 },
  infoBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  infoText: { color: COLORS.icon, flex: 1 },
  colorBtn: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorPreview: { width: 18, height: 18, borderRadius: 9 },
  colorLabel: { flex: 1, fontWeight: '800', color: COLORS.text, fontSize: 13 },
  menuOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
  },
  menuHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  menuTitle: { fontWeight: '900', color: COLORS.text, fontSize: 16 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: COLORS.text },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontWeight: '900', color: COLORS.text, flex: 1 },
  count: { fontWeight: '900', color: COLORS.text },
  scheduleRow: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  scheduleText: { color: COLORS.textSecondary, fontWeight: '700' },
  muted: { color: COLORS.muted },
  studentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  studentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.icon, marginTop: 6 },
  studentName: { fontWeight: '800', color: COLORS.text },
  studentCode: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
});
