import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import { formatActionDateTime } from '../../utils/formatDateTime';
import {
  ArrowLeft,
  Clock,
  Maximize2,
  QrCode,
  RefreshCw,
  Share2,
  StopCircle,
  Users,
} from 'lucide-react-native';

import ScannableQR from '../../components/ScannableQR';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import { CLASS_DETAILS_URL, CREATE_ATTENDANCE_QR_URL, REGENERATE_CLASS_QR_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { alertAttendanceQrError } from '../../utils/attendanceQr';
import { isClassInProgressNow as classIsInProgress } from '../../utils/schedule';

// Hora (Colombia) en que vence el QR de clase, leída del token. La firma la valida el backend.
function tokenExpiryLabel(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part || typeof atob !== 'function') return '';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
    const exp = Number(JSON.parse(atob(b64))?.exp || 0);
    return exp ? formatActionDateTime(exp) : '';
  } catch {
    return '';
  }
}

export default function ClassQRScreen({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { width: windowWidth } = useWindowDimensions();
  // Tarjeta: ancho de pantalla - 48 de márgenes (máx. 360) - 36 de relleno; el QR suma 32 de borde blanco.
  const qrSize = Math.max(160, Math.min(240, Math.min(windowWidth - 48, 360) - 36 - 32));
  const { authToken } = useAuth();
  const classId = String(route?.params?.classId || '');
  const classIdPayload = Number.isFinite(Number(classId)) ? Number(classId) : classId;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const didAutoRegenerate = useRef(false);
  const [creatingAttendance, setCreatingAttendance] = useState(false);

  const [registeredCount, setRegisteredCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);


  const extractClassToken = (obj) => {
    try {
      const token =
        obj?.class?.classToken ||
        obj?.class?.token ||
        obj?.class?.qrToken ||
        obj?.class?.class_token ||
        obj?.class?.qr_token ||
        obj?.classToken ||
        obj?.token ||
        obj?.qrToken ||
        obj?.class_token ||
        obj?.qr_token ||
        obj?.data?.classToken ||
        obj?.data?.token ||
        obj?.data?.qrToken ||
        obj?.data?.class_token ||
        obj?.data?.qr_token ||
        '';
      return token ? String(token) : '';
    } catch {
      return '';
    }
  };


  const load = async () => {
    if (!CLASS_DETAILS_URL) {
      appAlert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }
    if (!authToken) {
      appAlert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return;
    }
    if (!classId) {
      appAlert('Error', 'classId inválido');
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
        body: JSON.stringify({ classId: classIdPayload }),
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
      const nextToken = extractClassToken(json);
      setDetails((prev) => {
        const prevToken = extractClassToken(prev);
        if (!nextToken && prevToken && json) {
          return { ...json, classToken: prevToken };
        }
        return json;
      });

      const token = nextToken;
      if (!token && !didAutoRegenerate.current && REGENERATE_CLASS_QR_URL) {
        didAutoRegenerate.current = true;
        try {
          await regenerateQr();
        } catch {
          // ignore; errors are already alerted inside regenerateQr
        }
      }
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const createAttendanceQr = async () => {
    if (!CREATE_ATTENDANCE_QR_URL) {
      appAlert('No disponible', 'Endpoint de asistencia no configurado');
      return;
    }
    if (!authToken || !classId) return;
    setCreatingAttendance(true);
    try {
      const resp = await fetch(CREATE_ATTENDANCE_QR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ classId: classIdPayload }),
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
      const attendancePayload =
        json?.attendance ||
        json?.session ||
        json?.attendanceSession ||
        json?.attendance_session ||
        json;
      navigation.navigate('TeacherAttendanceQr', { attendance: attendancePayload });
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    } finally {
      setCreatingAttendance(false);
    }
  };

  const regenerateQr = async () => {
    if (!REGENERATE_CLASS_QR_URL) {
      appAlert('No disponible', 'Endpoint de regeneración no configurado');
      return;
    }
    if (!authToken || !classId) return;
    try {
      const resp = await fetch(REGENERATE_CLASS_QR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ classId: classIdPayload }),
      });
      const text = await resp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (!resp.ok) throw new Error((json && (json.error || json.message || json.details)) || text);
      if (json) {
        const token = extractClassToken(json);
        if (token) {
          setDetails((prev) => ({ ...(prev || {}), ...(json || {}), classToken: token }));
        } else {
          setDetails((prev) => ({ ...(prev || {}), ...(json || {}) }));
        }
      }
      await load();
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);



  const c = details?.class;
  const title = c?.className || 'Clase';
  const group = c?.group || '';
  const room = c?.room || c?.classroom || c?.aula || '';
  const classToken =
    c?.classToken ||
    c?.token ||
    c?.qrToken ||
    c?.class_token ||
    c?.qr_token ||
    details?.classToken ||
    details?.token ||
    details?.qrToken ||
    details?.class_token ||
    details?.qr_token ||
    details?.data?.classToken ||
    details?.data?.token ||
    details?.data?.qrToken ||
    details?.class?.classToken ||
    details?.class?.token ||
    '';
  const studentsArr =
    (Array.isArray(c?.students) && c.students) ||
    (Array.isArray(c?.studentList) && c.studentList) ||
    (Array.isArray(c?.studentsList) && c.studentsList) ||
    (Array.isArray(c?.enrolledStudents) && c.enrolledStudents) ||
    (Array.isArray(c?.classStudents) && c.classStudents) ||
    (Array.isArray(c?.alumnos) && c.alumnos) ||
    [];
  const totalStudents =
    Number(c?.studentsCount) ||
    Number(c?.studentCount) ||
    Number(c?.totalStudents) ||
    Number(c?.enrolledCount) ||
    Number(c?.students?.length) ||
    Number(c?.class?.studentsCount) ||
    Number(studentsArr.length) ||
    0;

  const derivedRegisteredCount =
    Number(details?.registeredCount) ||
    Number(details?.registeredStudents) ||
    Number(c?.registeredCount) ||
    Number(c?.registeredStudents) ||
    0;

  useEffect(() => {
    if (derivedRegisteredCount) setRegisteredCount(derivedRegisteredCount);
  }, [derivedRegisteredCount]);

  const inProgress = classIsInProgress(c);
  const validUntil = tokenExpiryLabel(classToken);

  return (
    <View style={[styles.root, isFullscreen ? styles.fullscreen : null]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.hBtn}>
          <ArrowLeft size={24} color={COLORS.white} />
        </Pressable>
        <Text style={styles.hTitle}>Código QR de Clase</Text>
        <Pressable onPress={() => setIsFullscreen((v) => !v)} style={styles.hBtn}>
          <Maximize2 size={20} color={COLORS.white} />
        </Pressable>
      </View>

      <View style={styles.sessionInfo}>
        <Text style={styles.sessionTitle}>{title}{group ? ` • ${group}` : ''}</Text>
        <Text style={styles.sessionSub}>{room ? `Aula ${room} • ` : ''}{new Date().toLocaleTimeString()}</Text>
      </View>

      <View style={styles.center}>
        <View style={styles.qrCard}>
          <View style={styles.qrContainer}>
            {loading ? (
              <View style={styles.qrLoading}>
                <Text style={styles.qrLoadingText}>Cargando QR…</Text>
              </View>
            ) : classToken ? (
              <View style={styles.qrBox}>
                <ScannableQR value={String(classToken)} size={qrSize} />
              </View>
            ) : (
              <View style={styles.qrLoading}>
                <Text style={styles.qrLoadingText}>QR de clase no disponible</Text>
              </View>
            )}
          </View>

          <View style={{ height: 14 }} />

          <View style={styles.timerTop}>
            <View style={styles.timerLabelRow}>
              <Clock size={16} color={COLORS.muted} />
              <Text style={styles.timerLabel}>Válido hasta:</Text>
            </View>
            <Text style={styles.timerValue}>{validUntil || '—'}</Text>
          </View>

          <View style={styles.progressRow}>
            <Users size={16} color={COLORS.muted} />
            <Text style={styles.progressText}>
              <Text style={styles.progressPrimary}>{registeredCount}</Text>/{totalStudents} estudiantes registrados
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerGrid}>
          <Button
            variant="secondary"
            disabled={inProgress}
            onPress={() => {
              if (inProgress) {
                appAlert('No disponible', 'El QR de registro solo se puede generar fuera del horario de clase.');
                return;
              }
              regenerateQr();
            }}
          >
            <View style={styles.btnRow}>
              <RefreshCw size={16} color={COLORS.background} />
              <Text style={styles.btnOutlineText}>QR registro</Text>
            </View>
          </Button>
          <Button variant="secondary" isLoading={creatingAttendance} onPress={createAttendanceQr}>
            <View style={styles.btnRow}>
              <QrCode size={16} color={COLORS.background} />
              <Text style={styles.btnOutlineText}>QR asistencia</Text>
            </View>
          </Button>
        </View>
        <View style={{ height: 12 }} />
        <Button variant="secondary" onPress={() => navigation.goBack()}>
          <View style={styles.btnRow}>
            <StopCircle size={18} color={COLORS.dangerBorder} />
            <Text style={[styles.btnOutlineText, { color: COLORS.dangerBorder }]}>Finalizar Sesión</Text>
          </View>
        </Button>
      </View>
    </View>
  );
}

 const createStyles = (COLORS) => StyleSheet.create({
  // Fondo oscuro fijo en ambos temas: el texto de la cabecera es blanco.
  root: { flex: 1, backgroundColor: COLORS.scheme === 'dark' ? COLORS.background : COLORS.text },
  fullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  header: { paddingTop: 54, paddingHorizontal: 24, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  hTitle: { color: COLORS.white, fontWeight: '800' },
  sessionInfo: { paddingHorizontal: 24, paddingBottom: 8, alignItems: 'center' },
  sessionTitle: { color: COLORS.white, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  sessionSub: { marginTop: 4, color: 'rgba(255,255,255,0.60)', fontSize: 12, textAlign: 'center' },
  center: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  qrCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, width: '100%', maxWidth: 360, shadowColor: COLORS.black, shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  qrContainer: { alignItems: 'center', justifyContent: 'center', minHeight: 220 },
  qrBox: { alignItems: 'center', justifyContent: 'center' },
  qrLoading: { alignSelf: 'stretch', minHeight: 220, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  qrLoadingText: { color: COLORS.muted, fontWeight: '900' },
  qrDark: { position: 'absolute', left: 14, right: 14, top: 14, bottom: 14, backgroundColor: COLORS.text },
  qrModule: { position: 'absolute', width: '4%', height: '4%' },
  qrLogoOuter: { position: 'absolute', left: '50%', top: '50%', transform: [{ translateX: -24 }, { translateY: -24 }], width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  qrLogoInner: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  qrLogoText: { color: COLORS.white, fontWeight: '900', fontSize: 12 },
  timerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerLabel: { color: COLORS.muted },
  timerValue: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  progressRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  progressText: { color: COLORS.muted, textAlign: 'center' },
  progressPrimary: { color: COLORS.primary, fontWeight: '900' },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  footerGrid: { flexDirection: 'row', gap: 12 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Los botones 'secondary' tienen fondo COLORS.text; el contenido usa el color opuesto
  // para leerse tanto en tema claro como oscuro.
  btnOutlineText: { color: COLORS.background, fontWeight: '900' },
 });
