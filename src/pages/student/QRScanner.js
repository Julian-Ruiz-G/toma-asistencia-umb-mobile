// Importaciones necesarias para el componente de escaneo QR
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { COLORS } from '../../ui/theme';
import { JOIN_CLASS_URL, MARK_ATTENDANCE_URL } from '../../config';
import { useAuth } from '../../state/auth';

// Estados posibles del escaneo QR
const ScanState = {
  scanning: 'scanning', // Escaneando activamente
  success: 'success', // Escaneo exitoso
  error: 'error', // Error en el escaneo
  already_scanned: 'already_scanned', // Ya escaneado anteriormente
};

// Componente principal del escáner QR para estudiantes
export default function QRScanner({ navigation }) {
  // Obtener datos de autenticación del contexto
  const { authToken, email, studentCode } = useAuth();
  // Estados de permisos de cámara
  const [permission, requestPermission] = useCameraPermissions();
  // Estados locales del componente
  const [flashOn, setFlashOn] = useState(false); // Estado de la linterna
  const [scanState, setScanState] = useState(ScanState.scanning); // Estado actual del escaneo
  const [enabled, setEnabled] = useState(true); // Si el escaneo está habilitado
  const [attendanceStatus, setAttendanceStatus] = useState('present'); // Estado de asistencia tras escanear
  const [scanTime, setScanTime] = useState(''); // Hora del escaneo
  const [joinResult, setJoinResult] = useState(''); // Resultado de unión a clase
  const [scanMode, setScanMode] = useState(''); // Modo de escaneo (registro/asistencia)

  // Referencia para la animación de la línea de escaneo
  const lineAnim = useRef(new Animated.Value(0)).current;

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
    const a = Animated.loop(
      Animated.sequence([
        // Se anima la línea de escaneo hacia abajo
        Animated.timing(lineAnim, {
          toValue: 1,
          duration: 2000, // Duración de la animación
          useNativeDriver: true,
        }),
        // Se anima la línea de escaneo hacia arriba
        Animated.timing(lineAnim, {
          toValue: 0,
          duration: 2000, // Duración de la animación
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
        chipBg: '#EEF2FF',
        chipText: '#3730A3',
        iconBg: '#4F46E5',
        label: 'Registro',
        message: 'Te uniste a la clase',
        title: '¡Registro Exitoso!',
      },
      present: {
        chipBg: '#ECFDF5', // Fondo del chip
        chipText: '#15803D', // Color del texto
        iconBg: '#22C55E', // Fondo del ícono
        label: 'Presente', // Etiqueta a mostrar
        message: 'Llegaste a tiempo', // Mensaje de éxito
        title: '¡Asistencia Registrada!', // Título del modal
      },
      late: {
        chipBg: '#FFFBEB',
        chipText: '#A16207',
        iconBg: '#EAB308',
        label: 'Retardo',
        message: 'Llegaste tarde',
        title: 'Registro con Retardo',
      },
      absent: {
        chipBg: '#FEF2F2',
        chipText: '#B91C1C',
        iconBg: '#EF4444',
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
      console.log('🔍 DEBUG: Enviando asistencia:', { attendanceToken, studentEmail: email, studentCode });
      const resp = await fetch(MARK_ATTENDANCE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          attendanceToken, // Token del QR escaneado
          studentEmail: email || '', // Email del estudiante
          studentCode: studentCode || '', // Código del estudiante
        }),
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
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
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
      console.log('✅ DEBUG: Asistencia marcada exitosamente:', { status, response: json });
      setAttendanceStatus(status);
      setScanTime(String(json?.time || json?.markedAt || scanTime || ''));
      setJoinResult('');
      setScanState(ScanState.success);
    } catch (e) {
      console.log('❌ DEBUG: Error marcando asistencia:', e);
      // Manejar errores de la petición
      setJoinResult(e?.message || String(e));
      setScanState(ScanState.error);
    }
  };

  // Función para calcular estado de asistencia basado en hora actual (placeholder)
  const computeAttendanceStatus = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    // Formatear hora actual como HH:MM
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    setScanTime(timeString);

    const totalMinutes = hours * 60 + minutes;
    const classStartMinutes = 8 * 60;

    if (totalMinutes <= classStartMinutes + 10) return 'present';
    if (totalMinutes <= classStartMinutes + 20) return 'late';
    return 'absent';
  };

  // Función para reintentar el escaneo
  const handleRetry = () => {
    setEnabled(true); // Habilitar escaneo nuevamente
    setScanState(ScanState.scanning); // Cambiar a estado de escaneo
  };

  // Función para determinar si un token es probablemente de clase (registro)
  const isLikelyClassToken = (token) => {
    const t = String(token || '').trim();
    if (!t) return false;
    // Los tokens de asistencia suelen ser más largos y tener prefijos diferentes.
    // Para unirse a clase, el backend espera classToken (usualmente almacenado como classToken en detalles de clase).
    // Tratamos cualquier token corto-ish, no-URL, no-json como token de clase.
    if (t.startsWith('http://') || t.startsWith('https://')) return false;
    if (t.startsWith('{') || t.startsWith('[')) return false;
    // El prefijo mock antiguo era CLASS_. Seguimos aceptándolo.
    if (t.startsWith('CLASS_')) return true;
    // Heurística: classToken en este proyecto es comúnmente un token alfanumérico.
    return t.length >= 8 && t.length <= 120;
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
      // Realizar petición POST al backend para unirse a clase
      console.log('🔍 DEBUG: Enviando registro de clase:', { classToken, studentName: email, studentCode });
      console.log('🔍 DEBUG: JOIN_CLASS_URL:', JOIN_CLASS_URL);
      console.log('🔍 DEBUG: AuthToken:', authToken ? 'exists' : 'missing');
      
      const requestBody = {
        classToken, // Token de clase del QR
        studentName: email || '', // Nombre/email del estudiante
        studentCode: studentCode || '', // Código del estudiante
      };
      console.log('🔍 DEBUG: Request body:', JSON.stringify(requestBody, null, 2));
      
      const resp = await fetch(JOIN_CLASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('🔍 DEBUG: Response status:', resp.status);
      console.log('🔍 DEBUG: Response headers:', Object.fromEntries(resp.headers.entries()));
      
      const text = await resp.text();
      console.log('🔍 DEBUG: Response text:', text);
      
      let json;
      try {
        json = JSON.parse(text);
        console.log('🔍 DEBUG: Parsed JSON:', JSON.stringify(json, null, 2));
      } catch {
        console.log('❌ DEBUG: Failed to parse JSON response');
        json = null;
      }

      if (!resp.ok) {
        // Manejar errores de respuesta
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        console.log('❌ DEBUG: Error response:', msg);
        throw new Error(msg);
      }

      // Éxito en el registro
      console.log('✅ DEBUG: Registration successful:', json);
      const className = json?.className || json?.class?.className || 'la clase';
      setJoinResult(`✅ Te registraste exitosamente en ${className}`);
      setAttendanceStatus('register');
      setScanTime('');
      setScanState(ScanState.success);
    } catch (e) {
      // Manejar errores de la petición
      console.log('❌ DEBUG: Exception in submitJoinClass:', e);
      console.log('❌ DEBUG: Error message:', e?.message || String(e));
      setJoinResult(e?.message || String(e));
      setScanState(ScanState.error);
    }
  };

  // Función principal para manejar el resultado del escaneo QR
  const handleScanned = async (res) => {
    // Validar que el escaneo esté habilitado y en estado correcto
    if (!enabled || scanState !== ScanState.scanning) return;
    setEnabled(false); // Deshabilitar escaneo temporalmente

    // Extraer datos del QR
    const data = String(res?.data || '').trim();
    console.log('🔍 DEBUG: QR data extracted:', data);
    if (!data) {
      console.log('❌ DEBUG: Empty QR data, setting error state');
      setScanState(ScanState.error);
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

    // Fallback (no debería ocurrir): mantener heurística antigua
    if (isLikelyClassToken(data)) {
      await submitJoinClass(data);
      return;
    }
    // Si no se determina el modo, calcular estado de asistencia
    const status = computeAttendanceStatus();
    setAttendanceStatus(status);
    setJoinResult('');
    setScanState(ScanState.success);
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
        <View style={styles.modeOverlay}>
          <View style={styles.modeCard}>
            <Text style={styles.modeTitle}>¿Qué deseas escanear?</Text>
            <Text style={styles.modeText}>Selecciona el tipo de QR antes de abrir la cámara.</Text>
            <View style={{ height: 14 }} />
            <Button fullWidth onPress={() => setScanMode('attendance')}>Asistencia</Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="outline" onPress={() => setScanMode('register')}>Registro (unirse a clase)</Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="ghost" onPress={() => navigation.goBack()}>Cancelar</Button>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Escanear QR</Text>
        <Pressable onPress={() => setFlashOn((v) => !v)} style={styles.headerBtn}>
          {flashOn ? <Flashlight size={24} color="#FDE047" /> : <FlashlightOff size={24} color="#fff" />}
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

            <Animated.View
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
            </Animated.View>

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
        <View style={styles.bottomRow}>
          <Pressable onPress={() => {}} style={styles.smallCircleBtn}>
            <View style={styles.galleryThumb} />
          </Pressable>
          <Pressable
            onPress={() => {
              // Manual trigger for testing
              if (scanState === ScanState.scanning) {
                const status = computeAttendanceStatus();
                setAttendanceStatus(status);
                setScanState(ScanState.success);
                setEnabled(false);
              }
            }}
            style={styles.captureOuter}
          >
            <View style={styles.captureInner} />
          </Pressable>
          <Pressable onPress={() => {}} style={styles.smallCircleBtn}>
            <Text style={styles.helpText}>?</Text>
          </Pressable>
        </View>
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
        <View style={styles.overlay}>
          {scanState === ScanState.success ? (
            <View style={styles.resultCard}>
              <View style={[styles.resultIcon, { backgroundColor: cfg.iconBg }]}>
                <CheckCircle size={40} color="#fff" />
              </View>
              <Text style={styles.resultTitle}>{cfg.title}</Text>
              {joinResult ? <Text style={styles.resultSub}>{joinResult}</Text> : <Text style={styles.resultSub}>Asistencia procesada</Text>}
              {!joinResult ? <Text style={styles.resultSub2}>Se registró el escaneo</Text> : null}
              {scanMode !== 'register' ? (
                <View style={[styles.statusBox, { backgroundColor: cfg.chipBg }]}>
                  <Text style={[styles.statusLine1, { color: cfg.chipText }]}>Estado: {cfg.label}</Text>
                  <Text style={styles.statusLine2}>{scanTime} - {cfg.message}</Text>
                </View>
              ) : null}
              <Button fullWidth onPress={() => navigation.goBack()}>
                Continuar
              </Button>
            </View>
          ) : scanState === ScanState.error ? (
            <View style={styles.resultCard}>
              <View style={[styles.resultIcon, { backgroundColor: '#EF4444' }]}>
                <XCircle size={40} color="#fff" />
              </View>
              <Text style={styles.resultTitle}>QR Inválido</Text>
              <Text style={styles.resultMsg}>El código escaneado no corresponde a una clase válida o ha expirado.</Text>
              <Button fullWidth variant="outline" onPress={handleRetry}>
                Intentar de nuevo
              </Button>
            </View>
          ) : (
            <View style={styles.resultCard}>
              <View style={[styles.resultIcon, { backgroundColor: '#F59E0B' }]}>
                <AlertCircle size={40} color="#fff" />
              </View>
              <Text style={styles.resultTitle}>Ya Registrado</Text>
              <Text style={styles.resultMsg}>Tu asistencia ya fue registrada anteriormente para esta clase.</Text>
              <Button fullWidth variant="outline" onPress={() => navigation.goBack()}>
                Volver al inicio
              </Button>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const FRAME_SIZE = 288;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

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
  headerTitle: { color: '#fff', fontWeight: '800' },

  modeOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.70)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modeCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 18, padding: 18 },
  modeTitle: { fontWeight: '900', color: '#111827', fontSize: 16 },
  modeText: { marginTop: 6, color: '#6B7280', fontSize: 12, lineHeight: 16 },

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
    backgroundColor: 'rgba(185,28,28,0.45)',
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

  bottom: { backgroundColor: '#111827', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 22 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 },
  smallCircleBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center' },
  galleryThumb: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#6B7280' },
  helpText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  captureOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  bottomHint: { marginTop: 12, textAlign: 'center', color: '#6B7280' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  resultCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 360, alignItems: 'center' },
  resultIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 12 },
  resultTitle: { fontSize: 20, fontWeight: '900', color: '#111827', textAlign: 'center' },
  resultSub: { marginTop: 6, color: '#4B5563' },
  resultSub2: { marginTop: 2, color: '#6B7280', fontSize: 12, marginBottom: 14 },
  statusBox: { width: '100%', borderRadius: 14, padding: 14, marginBottom: 14 },
  statusLine1: { fontWeight: '900', textAlign: 'center' },
  statusLine2: { marginTop: 4, textAlign: 'center', color: '#4B5563' },
  resultMsg: { marginTop: 8, marginBottom: 14, color: '#6B7280', textAlign: 'center' },

  permissionRoot: { flex: 1, backgroundColor: COLORS.background, padding: 24, justifyContent: 'center' },
  permissionTitle: { fontSize: 20, fontWeight: '900', color: '#111827', textAlign: 'center' },
  permissionText: { marginTop: 8, textAlign: 'center', color: '#6B7280' },
});
