import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, FileText, ImagePlus, X } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { SUBMIT_JUSTIFICATION_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { appAlert } from '../../ui/appNotice';
import { useColors } from '../../ui/ThemeContext';
import { headerTop } from '../../ui/safeArea';

// Debe coincidir con MAX_JUSTIFICATION_BYTES del backend.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/*',
];

function formatSize(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function JustifyAbsence({ navigation, route }) {
  const record = route?.params?.record || {};
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken } = useAuth();
  const [reason, setReason] = useState('');
  // { base64, name, size, kind: 'photo' | 'document' }
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      appAlert('Permiso requerido', 'Autoriza el acceso a la galería para adjuntar la foto de la excusa.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) {
      setError('No se pudo leer la imagen.');
      return;
    }
    const size = Math.floor((asset.base64.length * 3) / 4);
    if (size > MAX_FILE_BYTES) {
      setError('La foto pesa más de 4 MB. Elige otra o recórtala.');
      return;
    }
    // Sin extensión: el servidor la pone según el contenido real (la galería puede nombrar .HEIC un JPG).
    setFile({ base64: asset.base64, name: 'Foto de la excusa', size, kind: 'photo' });
    setError('');
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: DOCUMENT_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      if (Number(asset.size || 0) > MAX_FILE_BYTES) {
        setError('El archivo pesa más de 4 MB. Adjunta uno más liviano.');
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      setFile({
        base64,
        name: String(asset.name || 'Soporte'),
        size: Number(asset.size || Math.floor((base64.length * 3) / 4)),
        kind: 'document',
      });
      setError('');
    } catch (e) {
      setError(e?.message || 'No se pudo leer el archivo.');
    }
  };

  const submit = async () => {
    const text = reason.trim();
    if (text.length < 10) {
      setError('Escribe el motivo con al menos 10 caracteres.');
      return;
    }
    if (!record.sessionId || !SUBMIT_JUSTIFICATION_URL || !authToken) {
      setError('No se pudo identificar la falta o la sesión.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(SUBMIT_JUSTIFICATION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          sessionId: record.sessionId,
          reason: text,
          ...(file ? { fileBase64: file.base64, fileName: file.name } : {}),
        }),
      });
      const raw = await resp.text();
      let json;
      try { json = JSON.parse(raw); } catch { json = null; }
      if (!resp.ok) {
        throw new Error((json && (json.message || json.error)) || raw || `HTTP ${resp.status}`);
      }
      appAlert(
        'Justificación enviada',
        json?.hasFile
          ? 'El docente la va a revisar. El soporte quedó guardado.'
          : 'El docente la va a revisar.'
      );
      navigation.goBack();
    } catch (e) {
      setError(e?.message || 'No se pudo enviar la justificación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Justificar falta</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {record.subject || 'Clase'} · {record.date || ''}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Motivo</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Cuenta qué pasó y por qué no pudiste asistir."
          placeholderTextColor={COLORS.placeholder}
          multiline
          style={styles.input}
        />
        <Text style={styles.hint}>Tienes 7 días desde la clase. El docente de la materia aprueba o rechaza.</Text>

        <Text style={styles.label}>Soporte (opcional)</Text>
        {file ? (
          <View style={styles.fileCard}>
            {file.kind === 'photo'
              ? <ImagePlus size={18} color={COLORS.primary} />
              : <FileText size={18} color={COLORS.primary} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.fileText} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileMeta}>{formatSize(file.size)}</Text>
            </View>
            <Pressable onPress={() => setFile(null)} hitSlop={8} accessibilityLabel="Quitar adjunto">
              <X size={18} color={COLORS.icon} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.pickRow}>
            <Pressable onPress={pickImage} style={styles.fileBtn}>
              <ImagePlus size={18} color={COLORS.primary} />
              <Text style={styles.fileText}>Foto</Text>
            </Pressable>
            <Pressable onPress={pickDocument} style={styles.fileBtn}>
              <FileText size={18} color={COLORS.primary} />
              <Text style={styles.fileText}>Documento</Text>
            </Pressable>
          </View>
        )}
        <Text style={styles.hint}>PDF, Word o foto de la excusa, de hasta 4 MB.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button fullWidth size="lg" onPress={submit} isLoading={loading}>
          Enviar justificación
        </Button>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: headerTop(12),
    paddingBottom: 16,
    backgroundColor: COLORS.card,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { marginTop: 2, fontSize: 13, color: COLORS.textSecondary },
  body: { padding: 20 },
  label: { marginBottom: 8, fontWeight: '800', color: COLORS.textSecondary },
  input: {
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  hint: { marginTop: 10, marginBottom: 14, color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  pickRow: { flexDirection: 'row', gap: 10 },
  fileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  fileText: { color: COLORS.text, fontWeight: '700' },
  fileMeta: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  error: { marginBottom: 12, color: COLORS.danger, fontWeight: '700' },
});
