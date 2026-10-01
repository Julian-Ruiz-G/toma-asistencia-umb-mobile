import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, CircleAlert, CircleCheck } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import { appAlert } from '../../ui/appNotice';
import { ADMIN_CREATE_STUDENT_URL, VALIDATE_REGISTER_PHOTO_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { passwordIssue } from '../../utils/passwordRules';
import { AdminNavButtons, useAdminDrawer } from '../../components/AdminDrawer';
import { MenuButton } from '../../components/RoleDrawer';
import AppSwitch from '../../components/AppSwitch';
import { headerTop } from '../../ui/safeArea';

const EMPTY = { fullName: '', email: '', studentCode: '', password: '', consentBiometric: false };

async function readJson(resp) {
  const text = await resp.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

// Pantalla (no Modal): en iOS la cámara y las alertas no se abren encima de un Modal.
export default function CrearEstudiantePage({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useAdminDrawer(navigation, 'AdminCreateStudent');
  const { authToken } = useAuth();
  const [draft, setDraft] = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [formError, setFormError] = useState('');
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const [creating, setCreating] = useState(false);

  const setField = (key) => (value) => {
    setDraft((p) => ({ ...p, [key]: value }));
    setFormError('');
  };

  // La foto se revisa apenas se toma: calidad del rostro y que no esté registrado en otra cuenta.
  const takePhoto = async () => {
    setPhotoError('');
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        setPhotoError('Se necesita permiso de cámara para tomar la foto del estudiante.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.75,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (result.canceled) return;
      const asset = Array.isArray(result.assets) ? result.assets[0] : null;
      const b64 = asset?.base64 ? String(asset.base64) : '';
      if (!b64) {
        setPhotoError('No se pudo leer la imagen. Intenta otra vez.');
        return;
      }

      setPhoto(null);
      setCheckingPhoto(true);
      try {
        const resp = await fetch(VALIDATE_REGISTER_PHOTO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: b64 }),
        });
        const { json } = await readJson(resp);
        if (json?.error === 'FaceAlreadyRegistered') {
          const msg = json.message || 'Este rostro ya está registrado en otra cuenta.';
          setPhotoError(msg);
          appAlert('Rostro ya registrado', msg);
          return;
        }
        const issues = Array.isArray(json?.issues) ? json.issues.filter(Boolean) : [];
        if (issues.length || !resp.ok) {
          setPhotoError(issues.length ? issues.join('\n') : (json?.message || `No se pudo revisar la foto (HTTP ${resp.status}).`));
          return;
        }
      } finally {
        setCheckingPhoto(false);
      }

      setPhoto({ base64: b64, uri: asset?.uri || '' });
    } catch (e) {
      setCheckingPhoto(false);
      setPhotoError(e?.message || String(e));
    }
  };

  const createStudent = async () => {
    const payload = {
      fullName: String(draft.fullName || '').trim(),
      email: String(draft.email || '').trim().toLowerCase(),
      studentCode: String(draft.studentCode || '').trim(),
      password: String(draft.password || '').trim(),
      consentBiometric: !!draft.consentBiometric,
    };
    const problem =
      (!payload.fullName || !payload.email || !payload.password) ? 'Completa nombre, correo y contraseña.'
        : passwordIssue(payload.password)
          || (!photo?.base64 ? 'Toma la foto del rostro del estudiante.' : '')
          || (!payload.consentBiometric ? 'Confirma que el estudiante autorizó el tratamiento de sus datos biométricos.' : '');
    if (problem) {
      setFormError(problem);
      return;
    }
    if (!authToken || !ADMIN_CREATE_STUDENT_URL) {
      setFormError('Sesión inválida o API no configurada.');
      return;
    }

    setCreating(true);
    setFormError('');
    try {
      const resp = await fetch(ADMIN_CREATE_STUDENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ ...payload, imageBase64: photo.base64 }),
      });
      const { json, text } = await readJson(resp);
      if (!resp.ok) {
        if (json?.error === 'UnknownRoute') {
          throw new Error('El servidor aún no tiene esta función. Hay que desplegar el backend actualizado.');
        }
        if (json?.error === 'FaceAlreadyRegistered') {
          setPhoto(null);
          setPhotoError(json.message || 'Este rostro ya está registrado en otra cuenta.');
        }
        throw new Error((json && (json.message || json.error)) || text || `HTTP ${resp.status}`);
      }

      appAlert(
        'Estudiante creado',
        'Entrégale la contraseña temporal. Al iniciar sesión deberá cambiarla y aceptar los términos y la política de privacidad.'
      );
      goBack();
    } catch (e) {
      setFormError(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <AdminNavButtons onBack={goBack} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Nuevo estudiante</Text>
          <Text style={styles.headerSubtitle}>Cuenta y foto para el reconocimiento facial</Text>
        </View>
        <MenuButton onPress={openDrawer} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            value={draft.fullName}
            onChangeText={setField('fullName')}
            placeholder="Ej: Juan Pérez"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
          />

          <Text style={styles.label}>Correo</Text>
          <TextInput
            value={draft.email}
            onChangeText={setField('email')}
            placeholder="estudiante@academia.umb.edu.co"
            placeholderTextColor={COLORS.placeholder}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={styles.label}>Código estudiante (opcional)</Text>
          <TextInput
            value={draft.studentCode}
            onChangeText={setField('studentCode')}
            placeholder="2023..."
            placeholderTextColor={COLORS.placeholder}
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Contraseña temporal</Text>
          <TextInput
            value={draft.password}
            onChangeText={setField('password')}
            placeholder="Mín. 8, mayúscula, número y símbolo"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.hint}>El estudiante deberá cambiarla al iniciar sesión.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Foto del rostro</Text>
          <Text style={styles.hint}>Un solo rostro, de frente, sin gafas y con buena luz.</Text>
          <View style={styles.photoRow}>
            {photo?.uri ? (
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
            ) : (
              <View style={[styles.photoPreview, styles.photoEmpty]}>
                <Camera size={24} color={COLORS.placeholder} />
              </View>
            )}
            <View style={{ flex: 1, gap: 8 }}>
              <Pressable
                onPress={takePhoto}
                disabled={checkingPhoto || creating}
                style={[styles.photoBtn, (checkingPhoto || creating) ? styles.disabled : null]}
              >
                {checkingPhoto ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Camera size={16} color={COLORS.primary} />
                )}
                <Text style={styles.photoBtnText}>
                  {checkingPhoto ? 'Revisando rostro…' : photo ? 'Tomar otra' : 'Tomar foto'}
                </Text>
              </Pressable>
              {photo && !photoError ? (
                <View style={styles.okRow}>
                  <CircleCheck size={14} color={COLORS.successStrong} />
                  <Text style={styles.okText}>Foto válida y rostro no registrado</Text>
                </View>
              ) : null}
            </View>
          </View>
          {photoError ? (
            <View style={styles.errorBox}>
              <CircleAlert size={16} color={COLORS.dangerStrong} />
              <Text style={styles.errorText}>{photoError}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, styles.consentRow]}>
          <Text style={styles.consentText}>El estudiante autorizó el tratamiento de sus datos biométricos</Text>
          <AppSwitch value={!!draft.consentBiometric} onValueChange={setField('consentBiometric')} />
        </View>

        {formError ? (
          <View style={styles.errorBox}>
            <CircleAlert size={16} color={COLORS.dangerStrong} />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <Button fullWidth onPress={createStudent} disabled={creating || checkingPhoto}>
          {creating ? 'Creando…' : 'Crear estudiante'}
        </Button>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.card,
    paddingTop: headerTop(12),
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.surface },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  body: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  cardTitle: { fontWeight: '900', color: COLORS.text },
  label: { marginTop: 10, color: COLORS.textSecondary, fontWeight: '900', fontSize: 12 },
  input: { marginTop: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text },
  hint: { marginTop: 6, color: COLORS.textSecondary, fontSize: 12 },
  photoRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoPreview: { width: 84, height: 112, borderRadius: 12 },
  photoEmpty: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  photoBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  disabled: { opacity: 0.5 },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  okText: { color: COLORS.successStrong, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  errorBox: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  errorText: { flex: 1, color: COLORS.dangerStrong, fontSize: 13, fontWeight: '700' },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  consentText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
});
