import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, ImagePlus } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { SUBMIT_JUSTIFICATION_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { appAlert } from '../../ui/appNotice';
import { useColors } from '../../ui/ThemeContext';

export default function JustifyAbsence({ navigation, route }) {
  const record = route?.params?.record || {};
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken } = useAuth();
  const [reason, setReason] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [fileLabel, setFileLabel] = useState('');
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
    setImageBase64(asset.base64);
    setFileLabel(asset.fileName || 'Foto adjunta');
    setError('');
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
          ...(imageBase64 ? { imageBase64 } : {}),
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
          ? 'El docente la va a revisar. La foto quedó guardada.'
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
        <Pressable onPress={pickImage} style={styles.fileBtn}>
          <ImagePlus size={18} color={COLORS.primary} />
          <Text style={styles.fileText}>{fileLabel || 'Adjuntar foto de la excusa (opcional)'}</Text>
        </Pressable>
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
    paddingTop: 48,
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
  fileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  fileText: { flex: 1, color: COLORS.text, fontWeight: '700' },
  error: { marginBottom: 12, color: COLORS.danger, fontWeight: '700' },
});
