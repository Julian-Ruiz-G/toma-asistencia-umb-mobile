import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CloudUpload,
  ImagePlus,
  ScanFace,
  UserX,
  Users,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import { CONFIRM_ATTENDANCE_PHOTO_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { alertClassHoursError } from '../../utils/attendanceQr';
import { headerTop } from '../../ui/safeArea';

const REQUEST_TIMEOUT_MS = 90 * 1000;

const STATUS_LABEL = {
  asistencia: 'Asistencia',
  retardo: 'Retardo',
  inasistencia: 'Inasistencia',
  justificada: 'Justificada',
};

// fetch no informa el avance de la subida; XMLHttpRequest sí (xhr.upload.onprogress).
function postJsonWithUploadProgress(url, authToken, body, onUploadProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.timeout = REQUEST_TIMEOUT_MS;
    if (xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onUploadProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText || '' });
    xhr.onerror = () => reject(new Error('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.'));
    xhr.ontimeout = () => reject(new Error(
      'El servidor tardó demasiado en responder. Revisa la asistencia antes de repetir la foto: puede que sí se haya guardado.'
    ));
    xhr.send(JSON.stringify(body));
  });
}

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
}

export default function FaceRecognitionScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken } = useAuth();
  const attendanceSession = route?.params?.attendanceSession;
  const classMeta = route?.params?.classMeta;
  const classId = route?.params?.classId;
  const autoCapture = Boolean(route?.params?.autoCapture);
  const sessionId = attendanceSession?.sessionId || attendanceSession?.session?.sessionId || '';

  // idle → uploading → processing → done (o de vuelta a idle si hay error)
  const [phase, setPhase] = useState('idle');
  const [photoUri, setPhotoUri] = useState('');
  const [photoSizeMb, setPhotoSizeMb] = useState(0);
  const [uploadRatio, setUploadRatio] = useState(0);
  const [now, setNow] = useState(0);
  const [elapsedFinal, setElapsedFinal] = useState(0);
  const [result, setResult] = useState(null);
  // Al entrar desde "Foto" se pregunta si tomar la foto o elegirla de la galería.
  const [showSourcePicker, setShowSourcePicker] = useState(autoCapture);

  const busy = phase === 'uploading' || phase === 'processing' || phase === 'finishing';

  const startedAtRef = useRef(0);
  const processingAtRef = useRef(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const startProcessing = () => {
    if (!processingAtRef.current) processingAtRef.current = Date.now();
    setPhase((p) => (p === 'uploading' ? 'processing' : p));
  };

  // Reloj de la pantalla mientras se envía y procesa la foto (5 veces por segundo).
  useEffect(() => {
    if (!busy) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [busy]);

  // Si el teléfono no informa el avance de la subida, se pasa a la etapa del servidor
  // en vez de dejar la barra quieta en 0 %.
  useEffect(() => {
    if (phase === 'uploading' && uploadRatio === 0 && now - startedAtRef.current > 2500) startProcessing();
  }, [phase, uploadRatio, now]);

  const elapsedSeconds = busy
    ? Math.max(0, Math.floor((now - startedAtRef.current) / 1000))
    : elapsedFinal;

  // Una sola barra: 0-40 % es la subida real; 40-95 % avanza con el tiempo real que lleva
  // el servidor (se acerca a 95 % sin llegar, porque no sabemos cuánto falta); 100 % al responder.
  let overall = 0;
  if (phase === 'uploading') {
    overall = 0.04 + 0.36 * uploadRatio;
  } else if (phase === 'processing') {
    const t = Math.max(0, now - processingAtRef.current);
    overall = 0.4 + 0.55 * (1 - Math.exp(-t / 9000));
  } else if (phase === 'finishing' || phase === 'done') {
    overall = 1;
  }

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: overall,
      duration: 220,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [overall, progressAnim]);

  const submitAttendancePhoto = async (b64) => {
    const { status, text } = await postJsonWithUploadProgress(
      CONFIRM_ATTENDANCE_PHOTO_URL,
      authToken,
      { sessionId, imageBase64: b64 },
      (ratio) => {
        setUploadRatio(ratio);
        if (ratio >= 1) startProcessing();
      },
    );

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (status < 200 || status >= 300) {
      if (alertClassHoursError(json)) {
        throw new Error('HOURS_NOTICE');
      }
      const msg = (json && (json.message || json.error)) || text || `HTTP ${status}`;
      throw new Error(msg);
    }

    return json;
  };

  const processPickedImage = async (pickImage) => {
    if (busy) return;

    try {
      if (!CONFIRM_ATTENDANCE_PHOTO_URL) throw new Error('Endpoint de foto no configurado');
      if (!authToken) throw new Error('Sesión inválida');
      if (!sessionId) throw new Error('sessionId inválido');

      const pickerResult = await pickImage();
      if (pickerResult.canceled) return;

      const asset = pickerResult.assets?.[0];
      const b64 = asset?.base64;
      if (!b64) throw new Error('No se pudo leer la foto.');

      setResult(null);
      setPhotoUri(asset?.uri || '');
      setPhotoSizeMb((b64.length * 0.75) / (1024 * 1024));
      setUploadRatio(0);
      startedAtRef.current = Date.now();
      processingAtRef.current = 0;
      progressAnim.setValue(0);
      setNow(Date.now());
      setPhase('uploading');

      const json = await submitAttendancePhoto(b64);
      setElapsedFinal(Math.floor((Date.now() - startedAtRef.current) / 1000));
      // Se deja ver la barra completa un instante antes de mostrar los resultados.
      setPhase('finishing');
      await new Promise((r) => setTimeout(r, 450));
      setResult(json || {});
      setPhase('done');
    } catch (e) {
      setElapsedFinal(Math.floor((Date.now() - startedAtRef.current) / 1000));
      setPhase('idle');
      if (String(e?.message || '') !== 'HOURS_NOTICE') {
        appAlert('No se pudo registrar la foto', e?.message || String(e));
      }
    }
  };

  const handleCapture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      appAlert('Permiso de cámara', 'Activa la cámara en Ajustes para tomar la foto de asistencia.');
      return;
    }
    await processPickedImage(() => ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 }));
  };

  const handlePickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      appAlert('Permiso de galería', 'Activa el acceso a tus fotos en Ajustes para elegir una imagen.');
      return;
    }
    await processPickedImage(() => ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
      allowsEditing: false,
      mediaTypes: ['images'],
    }));
  };

  // Cierra el selector y abre la cámara o la galería cuando el modal ya se ocultó (iOS no abre el picker encima de un Modal).
  const chooseSource = (source) => {
    setShowSourcePicker(false);
    setTimeout(() => {
      if (source === 'camera') handleCapture();
      else handlePickFromGallery();
    }, 350);
  };

  const goToAttendance = () => navigation.navigate('TeacherLiveAttendanceDashboard', {
    classId,
    attendanceSession,
    classMeta,
  });

  const facesDetected = Number(result?.facesDetected || 0);
  const presentCount = Number(result?.presentCount || 0);
  const unknownFaces = Math.max(0, facesDetected - presentCount);
  const students = useMemo(() => {
    const rows = Array.isArray(result?.results) ? result.results : [];
    return [...rows].sort((a, b) => Number(!!b.presentInPhoto) - Number(!!a.presentInPhoto)
      || String(a.studentName || a.studentEmail).localeCompare(String(b.studentName || b.studentEmail)));
  }, [result]);

  const uploadPct = Math.round(uploadRatio * 100);
  const overallPct = Math.round(overall * 100);
  const uploadDone = phase !== 'uploading';
  const stepTitle = phase === 'uploading'
    ? 'Enviando foto…'
    : phase === 'processing'
      ? 'Reconociendo rostros…'
      : 'Listo';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} disabled={busy}>
          <ArrowLeft size={22} color={COLORS.white} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Foto de asistencia</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {classMeta?.title ? `${classMeta.title}${classMeta?.group ? ` • ${classMeta.group}` : ''}` : 'Reconocimiento grupal'}
          </Text>
        </View>
      </View>

      <View style={styles.stage}>
        {photoUri ? (
          <>
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            {busy ? <View style={styles.dim} /> : null}
          </>
        ) : (
          <View style={styles.emptyStage}>
            <View style={styles.emptyIcon}>
              <Users size={40} color={COLORS.white} />
            </View>
            <Text style={styles.emptyTitle}>Toma una foto del salón</Text>
            <Text style={styles.emptyText}>
              Desde el frente, con buena luz y con todos los rostros visibles. Los estudiantes del fondo deben verse de frente.
            </Text>
          </View>
        )}

        {busy ? (
          <View style={styles.progressCard}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{stepTitle}</Text>
              <Text style={styles.cardPct}>{overallPct}%</Text>
            </View>
            <View style={styles.track}>
              <Animated.View
                style={[
                  styles.fill,
                  { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>

            <View style={[styles.stepRow, { marginTop: 14 }]}>
              {uploadDone ? (
                <CheckCircle2 size={20} color={COLORS.successStrong} />
              ) : (
                <CloudUpload size={20} color={COLORS.primary} />
              )}
              <Text style={styles.stepText}>Enviar foto ({photoSizeMb.toFixed(1)} MB)</Text>
              <Text style={styles.stepMeta}>{uploadDone ? 'Enviada' : `${uploadPct}%`}</Text>
            </View>
            <View style={[styles.stepRow, { marginTop: 10, opacity: uploadDone ? 1 : 0.45 }]}>
              {phase === 'finishing' ? (
                <CheckCircle2 size={20} color={COLORS.successStrong} />
              ) : (
                <ScanFace size={20} color={uploadDone ? COLORS.primary : COLORS.muted} />
              )}
              <Text style={styles.stepText}>Reconocer rostros de la clase</Text>
            </View>

            <Text style={styles.elapsed}>Tiempo transcurrido: {formatElapsed(elapsedSeconds)}</Text>
            <Text style={styles.hint}>
              {phase === 'uploading'
                ? 'No cierres esta pantalla mientras se envía la foto.'
                : 'Se compara cada rostro con los estudiantes de la clase. En salones grandes puede tardar más.'}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sheet}>
        {phase === 'done' ? (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNum}>{facesDetected}</Text>
                <Text style={styles.summaryLbl}>Rostros en la foto</Text>
              </View>
              <View style={[styles.summaryItem, styles.summaryOk]}>
                <Text style={[styles.summaryNum, { color: COLORS.successStrong }]}>{presentCount}</Text>
                <Text style={styles.summaryLbl}>Identificados</Text>
              </View>
              <View style={[styles.summaryItem, unknownFaces ? styles.summaryWarn : null]}>
                <Text style={[styles.summaryNum, unknownFaces ? { color: COLORS.warningStrong } : null]}>{unknownFaces}</Text>
                <Text style={styles.summaryLbl}>Sin identificar</Text>
              </View>
            </View>
            <Text style={styles.summaryTime}>Procesado en {formatElapsed(elapsedSeconds)}</Text>

            {students.length ? (
              <ScrollView style={styles.list} contentContainerStyle={{ gap: 6 }}>
                {students.map((s) => (
                  <View key={s.studentEmail} style={styles.studentRow}>
                    {s.presentInPhoto ? (
                      <CheckCircle2 size={18} color={COLORS.successStrong} />
                    ) : (
                      <UserX size={18} color={COLORS.dangerStrong} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName} numberOfLines={1}>{s.studentName || s.studentEmail}</Text>
                      {s.studentCode ? <Text style={styles.studentCode}>{s.studentCode}</Text> : null}
                    </View>
                    <Text style={[styles.studentStatus, s.presentInPhoto ? { color: COLORS.successStrong } : null]}>
                      {STATUS_LABEL[s.status] || s.status || ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button fullWidth variant="outline" onPress={() => setShowSourcePicker(true)}>Repetir foto</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button fullWidth onPress={goToAttendance}>Ver asistencia</Button>
              </View>
            </View>
            <Text style={styles.repeatHint}>Repetir la foto reemplaza el resultado anterior.</Text>
          </>
        ) : (
          <View style={styles.captureRow}>
            <View style={styles.sideBtnWrap}>
              <Pressable
                onPress={handlePickFromGallery}
                disabled={busy}
                style={[styles.sideBtn, busy ? styles.disabled : null]}
                accessibilityLabel="Elegir de la galería"
              >
                <ImagePlus size={20} color={COLORS.white} />
              </Pressable>
              <Text style={styles.sideLbl}>Galería</Text>
            </View>

            <Pressable
              onPress={handleCapture}
              disabled={busy}
              style={[styles.captureOuter, busy ? styles.disabled : null]}
              accessibilityLabel="Tomar foto"
            >
              <View style={styles.captureInner}>
                <Camera size={30} color={COLORS.primary} />
              </View>
            </Pressable>

            {/* Espaciador para centrar el botón de captura. */}
            <View style={styles.sideBtnWrap} />
          </View>
        )}
      </View>

      <Modal
        visible={showSourcePicker}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="fade"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <Pressable style={styles.sourceBackdrop} onPress={() => setShowSourcePicker(false)}>
          <Pressable style={[styles.sourceCard, { paddingBottom: 30 + insets.bottom }]} onPress={() => {}}>
            <Text style={styles.sourceTitle}>Foto de asistencia</Text>
            <Text style={styles.sourceSub}>Toma una foto del aula o elige una desde la galería.</Text>

            <Pressable onPress={() => chooseSource('camera')} style={styles.sourceOption}>
              <Camera size={22} color={COLORS.primary} />
              <Text style={styles.sourceOptionText}>Tomar foto</Text>
            </Pressable>
            <Pressable onPress={() => chooseSource('gallery')} style={styles.sourceOption}>
              <ImagePlus size={22} color={COLORS.primary} />
              <Text style={styles.sourceOptionText}>Elegir de la galería</Text>
            </Pressable>

            <Pressable onPress={() => setShowSourcePicker(false)} style={styles.sourceCancel}>
              <Text style={styles.sourceCancelText}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.black },
  header: {
    paddingTop: headerTop(18),
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.black,
  },
  headerBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  headerSub: { marginTop: 2, color: 'rgba(255,255,255,0.62)', fontSize: 12 },

  stage: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)' },
  emptyStage: { alignItems: 'center', paddingHorizontal: 36 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 18, color: COLORS.white, fontWeight: '800', fontSize: 17, textAlign: 'center' },
  emptyText: { marginTop: 8, color: 'rgba(255,255,255,0.68)', textAlign: 'center', lineHeight: 20 },

  progressCard: { width: '86%', maxWidth: 340, backgroundColor: COLORS.card, borderRadius: 18, padding: 18 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: COLORS.text, fontWeight: '900', fontSize: 16 },
  cardPct: { color: COLORS.primary, fontWeight: '900', fontSize: 16, fontVariant: ['tabular-nums'] },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepText: { flex: 1, color: COLORS.text, fontWeight: '700' },
  stepMeta: { color: COLORS.muted, fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },
  track: { marginTop: 10, height: 10, width: '100%', borderRadius: 999, backgroundColor: COLORS.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.primary },
  elapsed: { marginTop: 16, color: COLORS.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hint: { marginTop: 6, color: COLORS.muted, fontSize: 12, lineHeight: 17 },

  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
  },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryItem: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', backgroundColor: COLORS.surface },
  summaryOk: { backgroundColor: COLORS.successBg },
  summaryWarn: { backgroundColor: COLORS.warningBg || COLORS.surface },
  summaryNum: { fontWeight: '900', fontSize: 20, color: COLORS.text },
  summaryLbl: { marginTop: 2, fontSize: 11, fontWeight: '700', color: COLORS.muted, textAlign: 'center' },
  summaryTime: { marginTop: 8, color: COLORS.muted, fontSize: 12, textAlign: 'center' },
  list: { marginTop: 12, maxHeight: 220 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  studentName: { color: COLORS.text, fontWeight: '700' },
  studentCode: { color: COLORS.muted, fontSize: 12 },
  studentStatus: { color: COLORS.dangerStrong, fontWeight: '800', fontSize: 12 },
  actions: { marginTop: 14, flexDirection: 'row', gap: 12 },
  repeatHint: { marginTop: 8, color: COLORS.muted, fontSize: 11, textAlign: 'center' },

  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  sideBtnWrap: { width: 64, alignItems: 'center' },
  sideBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sideLbl: { marginTop: 6, color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  captureOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },

  sourceBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)', justifyContent: 'flex-end' },
  sourceCard: { backgroundColor: COLORS.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 30, gap: 10 },
  sourceTitle: { fontWeight: '900', fontSize: 18, color: COLORS.text },
  sourceSub: { color: COLORS.muted, marginBottom: 6 },
  sourceOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  sourceOptionText: { fontWeight: '800', color: COLORS.text, fontSize: 15 },
  sourceCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  sourceCancelText: { color: COLORS.muted, fontWeight: '800' },
});
