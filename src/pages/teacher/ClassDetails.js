import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, BookOpen, QrCode, RefreshCw } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { CLASS_DETAILS_URL, CREATE_ATTENDANCE_QR_URL, REGENERATE_CLASS_QR_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { formatScheduleText } from '../../utils/schedule';

export default function ClassDetails({ navigation, route }) {
  const { authToken } = useAuth();
  const classId = route?.params?.classId;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!CLASS_DETAILS_URL) {
      Alert.alert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }
    if (!authToken) {
      Alert.alert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return;
    }
    if (!classId) {
      Alert.alert('Error', 'classId inválido');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(CLASS_DETAILS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
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
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const regenerateQr = async () => {
    if (!REGENERATE_CLASS_QR_URL) return;
    try {
      const resp = await fetch(REGENERATE_CLASS_QR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
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
      if (!resp.ok) throw new Error((json && (json.error || json.message || json.details)) || text);
      await load();
      Alert.alert('Listo', 'QR regenerado ✅');
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    }
  };

  const createAttendanceQr = async () => {
    if (!CREATE_ATTENDANCE_QR_URL) return;
    try {
      const resp = await fetch(CREATE_ATTENDANCE_QR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
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
        if (json?.error === 'NotScheduledToday') {
          Alert.alert('No programada hoy', `Hoy es ${json?.today || ''}. Esta clase no tiene horario para hoy.`);
          return;
        }
        throw new Error((json && (json.error || json.message || json.details)) || text);
      }
      const attendancePayload =
        json?.attendance ||
        json?.session ||
        json?.attendanceSession ||
        json?.attendance_session ||
        json;
      navigation.navigate('TeacherAttendanceQr', { attendance: attendancePayload });
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const c = details?.class;
  const classToken =
    c?.classToken ||
    c?.token ||
    details?.classToken ||
    details?.token ||
    details?.class?.classToken ||
    '';
  const scheduleStr = useMemo(() => formatScheduleText(c?.schedule || []), [c?.schedule]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Detalle clase</Text>
          <Text style={styles.headerSubtitle}>{c?.className ? 'Información de la sesión' : 'Cargando...'}</Text>
        </View>
        <Pressable onPress={load} style={styles.iconBtn}>
          <RefreshCw size={20} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>
              <BookOpen size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.className}>{c?.className || 'Clase'}</Text>
              <Text style={styles.classMeta}>Grupo: {c?.group || ''}</Text>
            </View>
          </View>

          {scheduleStr ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.blockTitle}>Horario</Text>
              <View style={styles.scheduleBox}>
                <Text style={styles.scheduleText}>{scheduleStr}</Text>
              </View>
            </View>
          ) : null}

          <View style={{ height: 14 }} />

          <View style={styles.actions}>
            <Button fullWidth isLoading={loading} onPress={createAttendanceQr}>
              Generar QR de asistencia
            </Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="outline" onPress={regenerateQr}>
              Regenerar QR de clase
            </Button>
          </View>

          {classToken ? (
            <View style={styles.qrWrap}>
              <View style={styles.qrCard}>
                <View style={styles.qrHeaderRow}>
                  <View style={styles.qrHeaderLeft}>
                    <View style={[styles.qrBadge, { backgroundColor: 'rgba(185,28,28,0.10)' }]}>
                      <QrCode size={16} color={COLORS.primary} />
                    </View>
                    <View>
                      <Text style={styles.qrTitle}>QR de Clase</Text>
                      <Text style={styles.qrSubtitle}>Los estudiantes lo usarán para registrarse</Text>
                    </View>
                  </View>
                </View>

                <View style={{ alignItems: 'center', marginTop: 14 }}>
                  <QRCode value={String(classToken)} size={230} />
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.muted}>classToken no disponible</Text>
          )}
        </View>

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
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(185,28,28,0.10)', alignItems: 'center', justifyContent: 'center' },
  className: { fontWeight: '900', color: '#111827', fontSize: 16 },
  classMeta: { marginTop: 2, color: '#6B7280' },
  blockTitle: { fontWeight: '900', color: '#374151' },
  scheduleBox: { marginTop: 8, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  scheduleText: { color: '#4B5563', lineHeight: 18 },
  actions: { marginTop: 6 },
  qrWrap: { marginTop: 16 },
  qrCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#F3F4F6', padding: 14 },
  qrHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qrBadge: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qrTitle: { fontWeight: '900', color: '#111827' },
  qrSubtitle: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  muted: { marginTop: 12, color: '#6B7280' },
});
