import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Maximize2,
  ScanFace,
  UserCheck,
  Zap,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { CONFIRM_ATTENDANCE_PHOTO_URL } from '../../config';
import { useAuth } from '../../state/auth';

export default function FaceRecognitionScreen({ navigation, route }) {
  const { authToken } = useAuth();
  const attendanceSession = route?.params?.attendanceSession;
  const classMeta = route?.params?.classMeta;
  const classId = route?.params?.classId;
  const autoCapture = Boolean(route?.params?.autoCapture);
  const sessionId = attendanceSession?.sessionId || attendanceSession?.session?.sessionId || '';

  const [isCapturing, setIsCapturing] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [showFlash, setShowFlash] = useState(false);
  const [recognitionProgress, setRecognitionProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const didAutoCapture = useRef(false);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: recognitionProgress / 100,
      duration: 120,
      useNativeDriver: false,
    }).start();
  }, [recognitionProgress, progressAnim]);

  const submitAttendancePhoto = async (b64) => {
    const resp = await fetch(CONFIRM_ATTENDANCE_PHOTO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ sessionId, imageBase64: b64 }),
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

    return json;
  };

  const processPickedImage = async (pickImage, options = {}) => {
    if (isCapturing) return;
    setIsCapturing(true);
    setDetectedFaces([]);

    if (options.flash) {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 200);
    }

    setRecognitionProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setRecognitionProgress(p);
      if (p >= 100) {
        clearInterval(interval);
      }
    }, 200);

    try {
      if (!CONFIRM_ATTENDANCE_PHOTO_URL) {
        throw new Error('Endpoint de foto no configurado');
      }
      if (!authToken) {
        throw new Error('Sesión inválida');
      }
      if (!sessionId) {
        throw new Error('sessionId inválido');
      }

      const pickerResult = await pickImage();

      if (pickerResult.canceled) {
        return;
      }

      const asset = pickerResult.assets?.[0];
      const b64 = asset?.base64;
      if (!b64) {
        throw new Error('No se pudo leer la foto (base64 vacío).');
      }

      const result = await submitAttendancePhoto(b64);

      const facesDetected = Number(result?.facesDetected || 0);
      const presentCount = Number(result?.presentCount || 0);

      Alert.alert(
        'Reconocimiento finalizado',
        `Personas detectadas en la foto: ${facesDetected}\nPersonas identificadas: ${presentCount}`,
        [
          {
            text: 'Ver asistencia',
            onPress: () => navigation.navigate('TeacherLiveAttendanceDashboard', {
              classId,
              attendanceSession,
              classMeta,
            }),
          },
        ],
      );
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      clearInterval(interval);
      setIsCapturing(false);
    }
  };

  const handleCapture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Error', 'Permiso de cámara denegado');
      return;
    }

    await processPickedImage(
      () => ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.7,
      }),
      { flash: true },
    );
  };

  const handlePickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Error', 'Permiso de galería denegado');
      return;
    }

    await processPickedImage(() => ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    }));
  };

  useEffect(() => {
    if (!autoCapture) return;
    if (didAutoCapture.current) return;
    didAutoCapture.current = true;
    handleCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCapture]);

  const recognizedCount = useMemo(() => detectedFaces.filter((f) => f.confidence > 80).length, [detectedFaces]);
  const totalDetected = detectedFaces.length;

  const borderColorFor = (confidence) => {
    if (confidence > 80) return '#22C55E';
    if (confidence > 0) return '#EAB308';
    return '#EF4444';
  };

  const labelBgFor = (confidence) => {
    if (confidence > 80) return '#22C55E';
    if (confidence > 0) return '#EAB308';
    return '#EF4444';
  };

  return (
    <View style={[styles.root, isFullscreen ? styles.fullscreen : null]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Reconocimiento Grupal</Text>
          <Text style={styles.headerSub}>Captura el aula completa</Text>
        </View>
        <Pressable onPress={() => setIsFullscreen((v) => !v)} style={styles.headerBtn}>
          <Maximize2 size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.cameraArea}>
        <View style={styles.fakeCameraBg}>
          <View style={styles.gridOverlay} />
          {detectedFaces.length === 0 && !isCapturing ? (
            <View style={styles.silhouettesRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={[styles.silhouette, { height: 110 + (i % 3) * 18, width: 64 + (i % 2) * 10 }]} />
              ))}
            </View>
          ) : null}
        </View>

        {detectedFaces.map((face) => {
          const bc = borderColorFor(face.confidence);
          const lb = labelBgFor(face.confidence);
          return (
            <View
              key={face.id}
              style={[
                styles.faceBox,
                {
                  left: `${face.x}%`,
                  top: `${face.y}%`,
                  width: `${face.w}%`,
                  height: `${face.h * 1.5}%`,
                  borderColor: bc,
                },
              ]}
            >
              <View style={[styles.faceLabel, { backgroundColor: lb }]}>
                <Text style={styles.faceLabelText}>
                  {face.confidence > 0 ? `${face.name} • ${face.confidence}%` : 'Desconocido'}
                </Text>
              </View>
              <View style={[styles.faceCorner, styles.faceCornerTL, { borderColor: bc }]} />
              <View style={[styles.faceCorner, styles.faceCornerTR, { borderColor: bc }]} />
              <View style={[styles.faceCorner, styles.faceCornerBL, { borderColor: bc }]} />
              <View style={[styles.faceCorner, styles.faceCornerBR, { borderColor: bc }]} />
            </View>
          );
        })}

        {showFlash ? <View style={styles.flash} /> : null}

        {isCapturing ? (
          <View style={styles.progressOverlay}>
            <View style={styles.progressCard}>
              <ScanFace size={44} color={COLORS.primary} />
              <Text style={styles.progressTitle}>Analizando rostros...</Text>
              <View style={styles.progressBarBg}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                  ]}
                />
              </View>
              <Text style={styles.progressPct}>{recognitionProgress}% completado</Text>
            </View>
          </View>
        ) : null}

        {detectedFaces.length === 0 && !isCapturing ? (
          <View style={styles.instructionWrap}>
            <Text style={styles.instructionText}>Asegúrate de que todos los estudiantes estén visibles</Text>
          </View>
        ) : null}
      </View>

      {detectedFaces.length > 0 ? (
        <View style={styles.resultsPanel}>
          <View style={styles.resultsTop}>
            <View style={styles.resultsTitleRow}>
              <UserCheck size={18} color="#22C55E" />
              <Text style={styles.resultsTitle}>Resultados</Text>
            </View>
            <Text style={styles.resultsCount}>{recognizedCount}/{totalDetected} reconocidos</Text>
          </View>

          <View style={styles.resultsGrid}>
            <View style={[styles.resultsMini, { backgroundColor: 'rgba(34,197,94,0.10)' }]}>
              <Text style={[styles.resultsNum, { color: '#22C55E' }]}>{detectedFaces.filter((f) => f.confidence > 80).length}</Text>
              <Text style={[styles.resultsLbl, { color: '#22C55E' }]}>Confirmados</Text>
            </View>
            <View style={[styles.resultsMini, { backgroundColor: 'rgba(234,179,8,0.10)' }]}>
              <Text style={[styles.resultsNum, { color: '#EAB308' }]}>{detectedFaces.filter((f) => f.confidence > 0 && f.confidence <= 80).length}</Text>
              <Text style={[styles.resultsLbl, { color: '#EAB308' }]}>Dudosos</Text>
            </View>
            <View style={[styles.resultsMini, { backgroundColor: 'rgba(239,68,68,0.10)' }]}>
              <Text style={[styles.resultsNum, { color: '#EF4444' }]}>{detectedFaces.filter((f) => f.confidence === 0).length}</Text>
              <Text style={[styles.resultsLbl, { color: '#EF4444' }]}>Desconocidos</Text>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 120 }}>
            <View style={{ gap: 6 }}>
              {detectedFaces.map((f) => (
                <View key={f.id} style={styles.faceRow}>
                  <View style={[styles.dot, { backgroundColor: borderColorFor(f.confidence) }]} />
                  <Text style={styles.faceRowName}>{f.name}</Text>
                  <Text style={styles.faceRowCode}>{f.code}</Text>
                  {f.confidence > 0 ? <Text style={styles.faceRowPct}>{f.confidence}%</Text> : null}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.bottom}>
        {detectedFaces.length > 0 ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Button fullWidth variant="outline" onPress={() => setDetectedFaces([])}>
                  Repetir
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button fullWidth onPress={() => navigation.goBack()}>
                  Guardar Asistencia
                </Button>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.bottomRow}>
            <Pressable onPress={handlePickFromGallery} disabled={isCapturing} style={[styles.smallCircleBtn, isCapturing ? { opacity: 0.5 } : null]}>
              <ImagePlus size={20} color="#9CA3AF" />
            </Pressable>

            <Pressable onPress={handleCapture} disabled={isCapturing} style={[styles.captureOuter, isCapturing ? { opacity: 0.5 } : null]}>
              <View style={styles.captureInner}>
                <Camera size={30} color="#111827" />
              </View>
            </Pressable>

            <Pressable onPress={() => {}} style={styles.smallCircleBtn}>
              <Zap size={20} color="#9CA3AF" />
            </Pressable>
          </View>
        )}
      </View>

      <Modal visible={false} transparent />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  fullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  headerBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontWeight: '800' },
  headerSub: { marginTop: 2, color: 'rgba(255,255,255,0.60)', fontSize: 12 },
  cameraArea: { flex: 1 },
  fakeCameraBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#374151' },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.20,
    backgroundColor: 'transparent',
  },
  silhouettesRow: { position: 'absolute', left: 0, right: 0, bottom: 120, flexDirection: 'row', justifyContent: 'center', gap: 18 },
  silhouette: { backgroundColor: 'rgba(75,85,99,0.55)', borderTopLeftRadius: 999, borderTopRightRadius: 999 },

  faceBox: { position: 'absolute', borderWidth: 2 },
  faceLabel: { position: 'absolute', left: 0, top: -26, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  faceLabelText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  faceCorner: { position: 'absolute', width: 10, height: 10 },
  faceCornerTL: { top: -2, left: -2, borderTopWidth: 2, borderLeftWidth: 2 },
  faceCornerTR: { top: -2, right: -2, borderTopWidth: 2, borderRightWidth: 2 },
  faceCornerBL: { bottom: -2, left: -2, borderBottomWidth: 2, borderLeftWidth: 2 },
  faceCornerBR: { bottom: -2, right: -2, borderBottomWidth: 2, borderRightWidth: 2 },

  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', opacity: 0.35, zIndex: 30 },

  progressOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.70)', alignItems: 'center', justifyContent: 'center', zIndex: 30, padding: 24 },
  progressCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 320, alignItems: 'center' },
  progressTitle: { marginTop: 10, fontWeight: '900', color: '#111827' },
  progressBarBg: { marginTop: 12, height: 8, width: '100%', borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.primary },
  progressPct: { marginTop: 8, color: '#6B7280' },

  instructionWrap: { position: 'absolute', left: 0, right: 0, bottom: 132, alignItems: 'center', paddingHorizontal: 24 },
  instructionText: { color: 'rgba(255,255,255,0.82)', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, fontWeight: '700' },

  resultsPanel: { backgroundColor: '#111827', borderTopWidth: 1, borderTopColor: '#1F2937', paddingHorizontal: 24, paddingVertical: 14 },
  resultsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  resultsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultsTitle: { color: '#fff', fontWeight: '900' },
  resultsCount: { color: 'rgba(255,255,255,0.60)' },
  resultsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  resultsMini: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  resultsNum: { fontWeight: '900', fontSize: 18 },
  resultsLbl: { marginTop: 2, fontWeight: '800', fontSize: 12 },
  faceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(31,41,55,0.55)', borderRadius: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  faceRowName: { color: '#fff', flex: 1 },
  faceRowCode: { color: '#9CA3AF', fontSize: 12 },
  faceRowPct: { color: '#9CA3AF', fontSize: 12 },

  bottom: { backgroundColor: '#111827', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 22 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 },
  smallCircleBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center' },
  captureOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
