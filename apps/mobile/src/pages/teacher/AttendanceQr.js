import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import ScannableQR from '../../components/ScannableQR';

import { Button } from '../../components/Button';
import { CREATE_ATTENDANCE_QR_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { useColors } from '../../ui/ThemeContext';
import { headerTop } from '../../ui/safeArea';

// El token del QR vence a los 90 s en el backend; se renueva antes para que una
// captura compartida con alguien fuera del salón deje de servir enseguida.
const REFRESH_MS = 45 * 1000;

function pickAttendanceToken(attendance) {
  return (
    attendance?.attendanceToken ||
    attendance?.token ||
    attendance?.attendance?.attendanceToken ||
    attendance?.session?.attendanceToken ||
    attendance?.attendanceSession?.attendanceToken ||
    attendance?.attendance_session?.attendanceToken ||
    ''
  );
}

export default function AttendanceQr({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { width: windowWidth } = useWindowDimensions();
  // Tarjeta: ancho de pantalla - 48 de márgenes (máx. 360) - 36 de relleno; el QR suma 32 de borde blanco.
  const qrSize = Math.max(160, Math.min(240, Math.min(windowWidth - 48, 360) - 36 - 32));
  const { authToken } = useAuth();
  const attendance = route?.params?.attendance;
  const corte = attendance?.corte || attendance?.session?.corte || attendance?.attendanceSession?.corte || '';
  const sessionId =
    attendance?.sessionId ||
    attendance?.session?.sessionId ||
    attendance?.attendanceSession?.sessionId ||
    attendance?.attendance_session?.sessionId ||
    '';
  const classId =
    attendance?.classId ||
    attendance?.session?.classId ||
    attendance?.attendanceSession?.classId ||
    '';

  const [attendanceToken, setAttendanceToken] = useState(pickAttendanceToken(attendance));
  const [stoppedMessage, setStoppedMessage] = useState('');
  const stoppedRef = useRef(false);

  const refreshToken = useCallback(async () => {
    if (stoppedRef.current || !CREATE_ATTENDANCE_QR_URL || !authToken || !classId) return;
    try {
      const resp = await fetch(CREATE_ATTENDANCE_QR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ classId, corte: corte || undefined }),
      });
      let json = null;
      try {
        json = JSON.parse(await resp.text());
      } catch {
        json = null;
      }
      if (resp.ok && json?.attendanceToken) {
        setAttendanceToken(String(json.attendanceToken));
        return;
      }
      if (resp.status === 400 || resp.status === 403) {
        // Fuera del horario de clase (u otra regla del backend): se deja de renovar.
        stoppedRef.current = true;
        setAttendanceToken('');
        setStoppedMessage(json?.message || 'El QR de asistencia ya no está disponible.');
      }
    } catch {
      // Sin conexión: se reintenta en el siguiente ciclo.
    }
  }, [authToken, classId, corte]);

  useFocusEffect(
    useCallback(() => {
      refreshToken();
      const id = setInterval(refreshToken, REFRESH_MS);
      return () => clearInterval(id);
    }, [refreshToken])
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.hBtn}>
          <ArrowLeft size={24} color={COLORS.white} />
        </Pressable>
        <Text style={styles.hTitle}>QR Asistencia</Text>
        <View style={styles.hBtnPlaceholder} />
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.title}>Escanea para registrar asistencia</Text>
          <Text style={styles.sub}>Corte: {corte}</Text>

          {attendanceToken ? (
            <>
              <View style={styles.qrWrap}>
                <View style={styles.qrBox}>
                  <ScannableQR value={String(attendanceToken)} size={qrSize} />
                </View>
              </View>
              <Text style={styles.muted}>El código se renueva solo cada 45 segundos.</Text>
            </>
          ) : (
            <Text style={styles.muted}>{stoppedMessage || 'No se pudo obtener el token de asistencia'}</Text>
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

const createStyles = (COLORS) => StyleSheet.create({
  // Fondo oscuro fijo en ambos temas: el texto de la cabecera es blanco.
  root: { flex: 1, backgroundColor: COLORS.scheme === 'dark' ? COLORS.background : COLORS.text },
  header: {
    paddingTop: headerTop(18),
    paddingHorizontal: 24,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  hBtnPlaceholder: { width: 42, height: 42 },
  hTitle: { color: COLORS.white, fontWeight: '800' },
  center: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, width: '100%', maxWidth: 360, shadowColor: COLORS.black, shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  title: { fontSize: 16, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  sub: { marginTop: 6, color: COLORS.muted, textAlign: 'center' },
  qrWrap: { marginTop: 14, alignItems: 'center' },
  qrBox: { borderRadius: 16 },
  muted: { marginTop: 14, color: COLORS.muted, textAlign: 'center' },
});
