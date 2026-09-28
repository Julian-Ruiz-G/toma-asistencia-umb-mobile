// Importaciones necesarias para el componente de escaneo QR
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated as RNAnimated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
// Importación de íconos desde lucide-react-native
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Flashlight,
  FlashlightOff,
  Scan,
  XCircle,
} from 'lucide-react-native';

// Importaciones de componentes y configuración
import { Button } from '../../components/Button';
import OverlayDismiss from '../../components/OverlayDismiss';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import Animated, { enterDown } from '../../ui/motion';
import { JOIN_CLASS_URL, MARK_ATTENDANCE_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { formatActionDateTime, formatClockTime } from '../../utils/formatDateTime';

// Estados posibles del escaneo QR
const ScanState = {
  scanning: 'scanning', // Escaneando activamente
  success: 'success', // Escaneo exitoso
  error: 'error', // Error en el escaneo
  already_scanned: 'already_scanned', // Ya escaneado anteriormente
};

// Componente principal del escáner QR para estudiantes
// Rol del token del QR ('class' para unirse, 'attendance' para asistencia). El payload del
// JWT es legible; la firma la valida el backend, esto solo decide a qué endpoint enviarlo.
function qrTokenRole(data) {
  try {
    const part = String(data || '').split('.')[1];
    if (!part || typeof atob !== 'function') return '';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
    return String(JSON.parse(atob(b64))?.role || '');
  } catch {
    return '';
  }
}

export default function QRScanner({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  // Obtener datos de autenticación del contexto
  const { authToken, refreshStudentClasses } = useAuth();
  // Estados de permisos de cámara
  const [permission, requestPermission] = useCameraPermissions();
  // Estados locales del componente
  const [flashOn, setFlashOn] = useState(false); // Estado de la linterna
  const [scanState, setScanState] = useState(ScanState.scanning); // Estado actual del escaneo
  const [enabled, setEnabled] = useState(true); // Si el escaneo está habilitado
  const [attendanceStatus, setAttendanceStatus] = useState('present'); // Estado de asistencia tras escanear
  const [scanTime, setScanTime] = useState(''); // Hora del escaneo
  const [processedAt, setProcessedAt] = useState('');
  const [joinResult, setJoinResult] = useState(''); // Resultado de unión a clase
  const [scanMode, setScanMode] = useState(''); // Modo de escaneo (registro/asistencia)

  // Referencia para la animación de la línea de escaneo
  const lineAnim = useRef(new RNAnimated.Value(0)).current;

  // Efecto para solicitar permisos de cámara al montar el componente
  useEffect(() => {
    (async () => {
      if (!permission?.granted) {
        // Si no se tienen permisos, se solicitan
        await requestPermission();
      }
    })();
  }, [permission?.granted, requestPermission]);

  // Efecto para animar la línea de escaneo cuando está activo
  useEffect(() => {
    // Se verifica si el estado actual es de escaneo activo
    if (scanState !== ScanState.scanning) return;
    // Se reinicia la animación de la línea de escaneo
    lineAnim.setValue(0);
    // Se crea la animación de la línea de escaneo
    const a = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(lineAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        RNAnimated.timing(lineAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    // Se inicia la animación
    a.start();
    // Se limpia la animación al desmontar el componente
    return () => a.stop();
  }, [scanState, lineAnim]);

  // Memoización para configuración visual según estado de asistencia
  const statusConfig = useMemo(() => {
    const map = {
      register: {
        chipBg: COLORS.primarySoft,
        chipText: COLORS.primaryDark,
        iconBg: COLORS.primary,
        label: 'Registro',
        message: 'Te uniste a la clase',
        title: '¡Registro Exitoso!',
      },
      present: {
        chipBg: COLORS.successSoft, // Fondo del chip
        chipText: COLORS.success, // Color del texto
        iconBg: COLORS.successStrong, // Fondo del ícono
        label: 'Presente', // Etiqueta a mostrar
        message: 'Llegaste a tiempo', // Mensaje de éxito
        title: '¡Asistencia Registrada!', // Título del modal
      },
      late: {
        chipBg: COLORS.warningSoft,
        chipText: COLORS.warning,
        iconBg: COLORS.warningStrong,
        label: 'Retardo',
        message: 'Llegaste tarde',
        title: 'Registro con Retardo',
      },
      absent: {
        chipBg: COLORS.dangerSoft,
        chipText: COLORS.danger,
        iconBg: COLORS.dangerStrong,
        label: 'Falta',
        message: 'No registrado a tiempo',
        title: 'No Registrado',
      },
    };

    return map;
  }, []);

  // Función asíncrona para marcar asistencia vía QR
  const submitMarkAttendance = async (attendanceToken) => {
    // Validaciones previas
    if (!MARK_ATTENDANCE_URL) {
      setJoinResult('API no configurada');
      setScanState(ScanState.error);
      return;
    }
    if (!authToken) {
      setJoinResult('Sesión inválida');
      setScanState(ScanState.error);
      return;
    }
    try {
      // Realizar petición POST al backend para marcar asistencia
      const resp = await fetch(MARK_ATTENDANCE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        // El backend identifica al estudiante por su sesión; solo necesita el token del QR.
        body: JSON.stringify({ attendanceToken }),
      });
      const text = await resp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (!resp.ok) {
        // Manejar errores de respuesta
        const msg = (json && (json.message || json.error)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      // Mapeo robusto del estado desde múltiples posibles campos y formatos
      const statusRaw = String(json?.status || json?.attendanceStatus || json?.result || json?.state || '').trim().toLowerCase();
      const status =
        statusRaw === 'late' ||
        statusRaw === 'retardo' ||
        statusRaw === 'tarde' ||
        statusRaw === 'tardy'
          ? 'late'
          : statusRaw === 'absent' ||
              statusRaw === 'inasistencia' ||
              statusRaw === 'falta' ||
              statusRaw === 'no_registrado'
            ? 'absent'
            : statusRaw === 'present' || statusRaw === 'presente' || statusRaw === 'asistencia'
              ? 'present'
              : 'present';
      const markedAt = json?.markedAt ?? Date.now();
      const clock = formatClockTime(markedAt, formatClockTime(Date.now()));
      setAttendanceStatus(status);
      setScanTime(clock);
      setProcessedAt(formatActionDateTime(markedAt));
      setJoinResult('');
      setScanState(ScanState.success);
    } catch (e) {
      // Manejar errores de la petición
      setJoinResult(e?.message || String(e));
      setScanState(ScanState.error);
    }
  };

  // Función para reintentar el escaneo
  const handleRetry = () => {
    setJoinResult('');
    setEnabled(true); // Habilitar escaneo nuevamente
    setScanState(ScanState.scanning); // Cambiar a estado de escaneo
  };

  // Función asíncrona para unirse a una clase via QR
  const submitJoinClass = async (classToken) => {
    // Validaciones previas
    if (!JOIN_CLASS_URL) {
      setJoinResult('API no configurada');
      setScanState(ScanState.error);
      return;
    }
    if (!authToken) {
      setJoinResult('Sesión inválida');
      setScanState(ScanState.error);
      return;
    }

    try {
      // Realizar petición POST al backend para unirse a clase.
      // Nombre y código los toma el backend del perfil del estudiante.
      const requestBody = { classToken };

      const resp = await fetch(JOIN_CLASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      const text = await resp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!resp.ok) {
        // Manejar errores de respuesta
        const msg = (json && (json.message || json.error)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      // Éxito en el registro
      const className = json?.className || json?.class?.className || 'la clase';
      setJoinResult(`✅ Te registraste exitosamente en ${className}`);
      setAttendanceStatus('register');
      setScanTime('');
      setScanState(ScanState.success);
      refreshStudentClasses();
    } catch (e) {
      // Manejar errores de la petición
      setJoinResult(e?.message || String(e));
      setScanState(ScanState.error);
    }
  };

  const closeSuccess = () => {
    const joined = scanMode === 'register' || Boolean(joinResult);
    setScanState(ScanState.scanning);
    setJoinResult('');
    setEnabled(true);
    setTimeout(() => {
      if (joined) navigation.navigate('StudentHome');
      else if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('StudentHome');
    }, 0);
  };
  const handleScanned = async (res) => {
    // Validar que el escaneo esté habilitado y en estado correcto
    if (!enabled || scanState !== ScanState.scanning) return;
    setEnabled(false); // Deshabilitar escaneo temporalmente

    // Extraer datos del QR
    const data = String(res?.data || '').trim();
    if (!data) {
      setScanState(ScanState.error);
      return;
    }

    // Si el QR dice qué es, se usa eso aunque se haya elegido el otro modo.
    const role = qrTokenRole(data);
    if (role === 'class') {
      await submitJoinClass(data);
      return;
    }
    if (role === 'attendance') {
      await submitMarkAttendance(data);
      return;
    }

    // Manejar según el modo de escaneo
    if (scanMode === 'register') {
      await submitJoinClass(data); // Modo registro: unirse a clase
      return;
    }

    if (scanMode === 'attendance') {
      await submitMarkAttendance(data); // Modo asistencia: marcar asistencia
      return;
    }

    // QR que no es de clase ni de asistencia (o sin modo elegido): no se registra nada.
    setJoinResult('Este QR no es de la app de asistencia. Escanea el código que muestra el docente.');
    setScanState(ScanState.error);
  };

  if (!permission?.granted) {
    return (
      <View style={styles.permissionRoot}>
        <Text style={styles.permissionTitle}>Permiso de cámara requerido</Text>
        <Text style={styles.permissionText}>Activa el permiso para escanear el QR del profesor.</Text>
        <View style={{ height: 14 }} />
        <Button onPress={requestPermission}>Dar permiso</Button>
        <View style={{ height: 10 }} />
        <Button variant="outline" onPress={() => navigation.goBack()}>
          Volver
        </Button>
      </View>
    );
  }

  const cfg = statusConfig[attendanceStatus] || statusConfig.present;

  return (
    <View style={styles.root}>
      <Modal
        visible={!scanMode}
        transparent
        animationType="fade"
        onRequestClose={() => navigation.goBack()}
      >
        <OverlayDismiss style={styles.modeOverlay} onClose={() => navigation.goBack()}>
          <Animated.View entering={enterDown(40)} style={styles.modeCard}>
            <Text style={styles.modeTitle}>¿Qué deseas escanear?</Text>
            <Text style={styles.modeText}>Selecciona el tipo de QR antes de abrir la cámara.</Text>
            <View style={{ height: 14 }} />
            <Button fullWidth onPress={() => setScanMode('attendance')}>Asistencia</Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="outline" onPress={() => setScanMode('register')}>Registro (unirse a clase)</Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="ghost" onPress={() => navigation.goBack()}>Cancelar</Button>
          </Animated.View>
        </OverlayDismiss>
      </Modal>

      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={24} color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Escanear QR</Text>
        <Pressable onPress={() => setFlashOn((v) => !v)} style={styles.headerBtn}>
          {flashOn ? <Flashlight size={24} color={COLORS.warningBorder} /> : <FlashlightOff size={24} color={COLORS.white} />}
        </Pressable>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          enableTorch={flashOn}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleScanned}
        />

        <View style={styles.dimTop} />
        <View style={styles.dimBottom} />

        <View style={styles.frameArea}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            <View style={styles.reticle}>
              <Scan size={30} color="rgba(255,255,255,0.55)" />
            </View>

            <RNAnimated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: lineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 288],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.scanLineGlow} />
            </RNAnimated.View>

            <View style={[styles.markerDot, { top: 14, left: 14 }]} />
            <View style={[styles.markerDot, { top: 14, right: 14 }]} />
            <View style={[styles.markerDot, { bottom: 14, left: 14 }]} />
            <View style={[styles.markerDot, { bottom: 14, right: 14 }]} />
          </View>
        </View>

        <View style={styles.instructionWrap}>
          <Text style={styles.instructionText}>Centra el código QR en el marco</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.bottomHint}>
          {scanMode === 'register'
            ? 'Escanea el QR del profesor para unirte a la clase'
            : 'Escanea el QR del profesor para registrar tu asistencia'}
        </Text>
      </View>

      <Modal
        visible={scanState !== ScanState.scanning}
        transparent
        animationType="fade"
        onRequestClose={() => setScanState(ScanState.scanning)}
      >
        <OverlayDismiss
          style={styles.overlay}
          onClose={() => {
            if (scanState === ScanState.success) closeSuccess();
            else handleRetry();
          }}
        >
          {scanState === ScanState.success ? (
            <View style={styles.resultCard}>
              <View style={[styles.resultIcon, { backgroundColor: cfg.iconBg }]}>
                <CheckCircle size={40} color={COLORS.white} />
              </View>
              <Text style={styles.resultTitle}>{cfg.title}</Text>
              {joinResult ? (
                <Text style={styles.resultSub}>{joinResult}</Text>
              ) : (
                <>
                  <Text style={styles.resultSub}>Asistencia procesada</Text>
                  <Text style={styles.resultTime}>{processedAt || scanTime || formatActionDateTime(Date.now())}</Text>
                </>
              )}
              {!joinResult ? <Text style={styles.resultSub2}>Se registró el escaneo</Text> : null}
              {attendanceStatus !== 'register' ? (
                <View style={[styles.statusBox, { backgroundColor: cfg.chipBg }]}>
                  <Text style={[styles.statusLine1, { color: cfg.chipText }]}>Estado: {cfg.label}</Text>
                  <Text style={styles.statusLine2}>{scanTime ? `${scanTime} - ${cfg.message}` : cfg.message}</Text>
                </View>
              ) : null}
              <Button fullWidth onPress={closeSuccess}>
                Continuar
              </Button>
            </View>
          ) : scanState === ScanState.error ? (
            <View style={styles.resultCard}>
              <View style={[styles.resultIcon, { backgroundColor: COLORS.dangerStrong }]}>
                <XCircle size={40} color={COLORS.white} />
              </View>
              <Text style={styles.resultTitle}>No se pudo registrar</Text>
              <Text style={styles.resultMsg}>
                {joinResult || 'El código escaneado no corresponde a una clase válida o ha expirado.'}
              </Text>
              <Button fullWidth variant="outline" onPress={handleRetry}>
                Intentar de nuevo
              </Button>
            </View>
          ) : (
            <View style={styles.resultCard}>
              <View style={[styles.resultIcon, { backgroundColor: COLORS.warningStrong }]}>
                <AlertCircle size={40} color={COLORS.white} />
              </View>
              <Text style={styles.resultTitle}>Ya Registrado</Text>
              <Text style={styles.resultMsg}>Tu asistencia ya fue registrada anteriormente para esta clase.</Text>
              <Button fullWidth variant="outline" onPress={() => navigation.goBack()}>
                Volver al inicio
              </Button>
            </View>
          )}
        </OverlayDismiss>
      </Modal>
    </View>
  );
}

const FRAME_SIZE = 288;

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.black },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: COLORS.white, fontWeight: '800' },

  modeOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.70)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modeCard: { width: '100%', maxWidth: 420, backgroundColor: COLORS.card, borderRadius: 18, padding: 18 },
  modeTitle: { fontWeight: '900', color: COLORS.text, fontSize: 16 },
  modeText: { marginTop: 6, color: COLORS.muted, fontSize: 12, lineHeight: 16 },

  cameraWrap: { flex: 1, position: 'relative' },
  dimTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '20%', backgroundColor: 'rgba(0,0,0,0.25)' },
  dimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '28%', backgroundColor: 'rgba(0,0,0,0.25)' },
  frameArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME_SIZE, height: FRAME_SIZE },

  corner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderColor: COLORS.primary,
  },
  cornerTL: { top: -4, left: -4, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 16 },
  cornerTR: { top: -4, right: -4, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 16 },
  cornerBL: { bottom: -4, left: -4, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: -4, right: -4, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 16 },

  reticle: { position: 'absolute', left: '50%', top: '50%', transform: [{ translateX: -15 }, { translateY: -15 }] },

  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  scanLineGlow: {
    position: 'absolute',
    left: '50%',
    top: -4,
    width: 90,
    height: 12,
    backgroundColor: COLORS.primaryOverlay,
    transform: [{ translateX: -45 }],
    borderRadius: 10,
  },

  markerDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  instructionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 132,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  instructionText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  bottom: { backgroundColor: COLORS.scheme === 'dark' ? COLORS.card : COLORS.text, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 22 },
  bottomHint: { marginTop: 12, textAlign: 'center', color: COLORS.muted },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  resultCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, width: '100%', maxWidth: 360, alignItems: 'center', zIndex: 2 },
  resultIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 12 },
  resultTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  resultSub: { marginTop: 6, color: COLORS.icon },
  resultTime: { marginTop: 4, color: COLORS.text, fontWeight: '800', fontSize: 15 },
  resultSub2: { marginTop: 2, color: COLORS.muted, fontSize: 12, marginBottom: 14 },
  statusBox: { width: '100%', borderRadius: 14, padding: 14, marginBottom: 14 },
  statusLine1: { fontWeight: '900', textAlign: 'center' },
  statusLine2: { marginTop: 4, textAlign: 'center', color: COLORS.icon },
  resultMsg: { marginTop: 8, marginBottom: 14, color: COLORS.muted, textAlign: 'center' },

  permissionRoot: { flex: 1, backgroundColor: COLORS.background, padding: 24, justifyContent: 'center' },
  permissionTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  permissionText: { marginTop: 8, textAlign: 'center', color: COLORS.muted },
});
