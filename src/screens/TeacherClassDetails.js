import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Card, PrimaryButton, Screen, SecondaryButton } from '../ui/components';
import { CLASS_DETAILS_URL, CREATE_ATTENDANCE_QR_URL, REGENERATE_CLASS_QR_URL } from '../config';
import { useAuth } from '../state/auth';
import QRCode from 'react-native-qrcode-svg';
import { formatScheduleText } from '../utils/schedule';

export default function TeacherClassDetails({ navigation, route }) {
  const { authToken } = useAuth();
  const classId = route?.params?.classId;
  const [details, setDetails] = useState(null);

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

    try {
      const resp = await fetch(CLASS_DETAILS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ classId })
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      setDetails(json);
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
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
        body: JSON.stringify({ classId })
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
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
        body: JSON.stringify({ classId })
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
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

  useEffect(() => { load(); }, [classId]);

  const c = details?.class;
  const classToken =
    c?.classToken ||
    c?.token ||
    details?.classToken ||
    details?.token ||
    details?.class?.classToken ||
    '';
  const scheduleStr = formatScheduleText(c?.schedule || []);

  return (
    <Screen title="Detalle clase" onBack={() => navigation.goBack()}>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '900', color: '#111827' }}>{c?.className || 'Clase'}</Text>
        <Text style={{ marginTop: 6, color: '#6B7280' }}>Grupo: {c?.group || ''}</Text>
        {scheduleStr ? (
          <Text style={{ marginTop: 6, color: '#6B7280' }}>Horario:\n{scheduleStr}</Text>
        ) : null}

        <View style={{ height: 12 }} />
        <PrimaryButton title="Generar QR de asistencia" onPress={createAttendanceQr} />
        <View style={{ height: 10 }} />
        <SecondaryButton title="Regenerar QR de clase" onPress={regenerateQr} />

        {classToken ? (
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <QRCode value={String(classToken)} size={220} />
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}
