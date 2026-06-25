import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '../../components/Button';

export default function AttendanceQr({ navigation, route }) {
  const attendance = route?.params?.attendance;
  const attendanceToken =
    attendance?.attendanceToken ||
    attendance?.token ||
    attendance?.attendance?.attendanceToken ||
    attendance?.session?.attendanceToken ||
    attendance?.attendanceSession?.attendanceToken ||
    attendance?.attendance_session?.attendanceToken ||
    '';
  const corte = attendance?.corte || attendance?.session?.corte || attendance?.attendanceSession?.corte || '';
  const sessionId =
    attendance?.sessionId ||
    attendance?.session?.sessionId ||
    attendance?.attendanceSession?.sessionId ||
    attendance?.attendance_session?.sessionId ||
    '';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.hBtn}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text style={styles.hTitle}>QR Asistencia</Text>
        <View style={styles.hBtnPlaceholder} />
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.title}>Escanea para registrar asistencia</Text>
          <Text style={styles.sub}>Corte: {corte}</Text>

          {attendanceToken ? (
            <View style={styles.qrWrap}>
              <View style={styles.qrBox}>
                <QRCode value={String(attendanceToken)} size={240} />
              </View>
            </View>
          ) : (
            <Text style={styles.muted}>No se pudo obtener el token de asistencia</Text>
          )}

          <View style={{ height: 14 }} />
          <Button
            fullWidth
            onPress={() =>
              navigation.navigate('TeacherLiveAttendanceDashboard', {
                attendanceSession: attendance,
                sessionId,
              })
            }
          >
            Ver asistencia en vivo
          </Button>
          <View style={{ height: 10 }} />
          <Button fullWidth variant="outline" onPress={() => navigation.goBack()}>
            Volver
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111827' },
  header: {
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  hBtnPlaceholder: { width: 42, height: 42 },
  hTitle: { color: '#fff', fontWeight: '800' },
  center: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827', textAlign: 'center' },
  sub: { marginTop: 6, color: '#6B7280', textAlign: 'center' },
  qrWrap: { marginTop: 14, alignItems: 'center' },
  qrBox: { backgroundColor: '#fff', borderRadius: 16, padding: 10 },
  muted: { marginTop: 14, color: '#6B7280', textAlign: 'center' },
});
