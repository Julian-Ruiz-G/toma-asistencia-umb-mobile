import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import { ArrowLeft, BookOpen, QrCode, RefreshCw } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import { CREATE_ATTENDANCE_QR_URL, MY_CLASSES_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { alertAttendanceQrError } from '../../utils/attendanceQr';

export default function CreateSession({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadClasses = async () => {
    if (!MY_CLASSES_URL) {
      appAlert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }
    if (!authToken) {
      appAlert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return;
    }

    setLoadingClasses(true);
    try {
      const resp = await fetch(MY_CLASSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
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

      const list = Array.isArray(json?.classes) ? json.classes : [];
      setClasses(list);
      if (!selectedClassId && list.length > 0) {
        const firstId = String(list[0]?.classId || list[0]?.id || '');
        if (firstId) setSelectedClassId(firstId);
      }
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedClass = useMemo(() => {
    return classes.find((c) => String(c?.classId || c?.id) === String(selectedClassId)) || null;
  }, [classes, selectedClassId]);

  const handleCreate = async () => {
    if (!CREATE_ATTENDANCE_QR_URL) {
      appAlert('API no configurada', 'Falta CREATE_ATTENDANCE_QR_URL');
      return;
    }
    if (!authToken) {
      appAlert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return;
    }
    if (!selectedClassId) {
      appAlert('Falta clase', 'Selecciona una clase');
      return;
    }

    setCreating(true);
    try {
      const resp = await fetch(CREATE_ATTENDANCE_QR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ classId: selectedClassId }),
      });
      const text = await resp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (!resp.ok) {
        if (alertAttendanceQrError(json, text)) return;
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      navigation.navigate('TeacherAttendanceQr', { attendance: json });
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Crear Sesión</Text>
          <Text style={styles.headerSubtitle}>Genera el QR de asistencia</Text>
        </View>
        <Pressable onPress={loadClasses} style={styles.iconBtn}>
          <RefreshCw size={20} color={COLORS.icon} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardIcon}>
              <BookOpen size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Selecciona una clase</Text>
              <Text style={styles.cardSub}>Solo se listan tus clases registradas</Text>
            </View>
          </View>

          <View style={{ height: 12 }} />

          {loadingClasses ? (
            <Text style={styles.muted}>Cargando clases…</Text>
          ) : classes.length === 0 ? (
            <Text style={styles.muted}>No tienes clases aún.</Text>
          ) : (
            <View style={styles.pillGrid}>
              {classes.map((c) => {
                const id = String(c?.classId || c?.id || '');
                const active = String(selectedClassId) === id;
                const title = c?.className || c?.subject || c?.name || 'Clase';
                const group = c?.group || c?.groupName || c?.grupo || '';
                return (
                  <Pressable
                    key={id}
                    onPress={() => setSelectedClassId(id)}
                    style={[styles.pill, active ? styles.pillActive : null]}
                  >
                    <Text style={[styles.pillText, active ? styles.pillTextActive : null]} numberOfLines={1}>
                      {title}{group ? ` • ${group}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {selectedClass ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryTitleRow}>
              <QrCode size={16} color={COLORS.primary} />
              <Text style={styles.summaryTitle}>Sesión de asistencia</Text>
            </View>
            <View style={{ height: 8 }} />
            <Text style={styles.summaryLine}>
              <Text style={styles.summaryKey}>Clase:</Text> {selectedClass?.className || selectedClass?.subject || selectedClass?.name || 'Clase'}
            </Text>
            <Text style={styles.summaryLine}>
              <Text style={styles.summaryKey}>Grupo:</Text> {selectedClass?.group || selectedClass?.groupName || selectedClass?.grupo || ''}
            </Text>
          </View>
        ) : null}

        <View style={{ height: 16 }} />
        <Button fullWidth size="lg" isLoading={creating} onPress={handleCreate}>
          Generar QR de asistencia
        </Button>

        <View style={{ height: 18 }} />
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
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontWeight: '900', color: COLORS.text, fontSize: 16 },
  cardSub: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  muted: { color: COLORS.muted, fontWeight: '800' },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.textSecondary, fontWeight: '800' },
  pillTextActive: { color: COLORS.white },
  summaryCard: {
    marginTop: 14,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryTitle: { fontWeight: '900', color: COLORS.text },
  summaryLine: { color: COLORS.textSecondary, marginTop: 4 },
  summaryKey: { fontWeight: '900', color: COLORS.text },
});
