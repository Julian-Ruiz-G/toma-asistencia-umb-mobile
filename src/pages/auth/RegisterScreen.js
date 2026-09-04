import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ArrowLeft, Bot, Camera, CheckCircle2, FileText, Shield } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { COLORS } from '../../ui/theme';
import { REGISTER_STUDENT_URL } from '../../config';
import TermsAndConditionsModal from '../../components/TermsAndConditions';
import PrivacyPolicyModal from '../../components/PrivacyPolicy';
import BiometricConsentModal from '../../components/BiometricConsent';

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    code: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    isNotRobot: false,
    consentBiometric: false,
    acceptTerms: false,
    acceptPrivacy: false,
  });
  const [errors, setErrors] = useState({});
  const [photoBase64, setPhotoBase64] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const validate = () => {
    const e = {};
    
    // Validar nombre
    if (!formData.firstName.trim()) {
      e.firstName = 'El nombre es requerido';
    } else if (formData.firstName.trim().length < 2) {
      e.firstName = 'Mínimo 2 caracteres';
    } else if (formData.firstName.trim().length > 50) {
      e.firstName = 'Máximo 50 caracteres';
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(formData.firstName.trim())) {
      e.firstName = 'Solo letras y espacios';
    }
    
    // Validar apellidos
    if (!formData.lastName.trim()) {
      e.lastName = 'Los apellidos son requeridos';
    } else if (formData.lastName.trim().length < 2) {
      e.lastName = 'Mínimo 2 caracteres';
    } else if (formData.lastName.trim().length > 50) {
      e.lastName = 'Máximo 50 caracteres';
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(formData.lastName.trim())) {
      e.lastName = 'Solo letras y espacios';
    }
    
    if (!formData.code.trim()) e.code = 'El código es requerido';
    else if (formData.code.trim().length < 8) e.code = 'Mínimo 8 caracteres';
    else if (formData.code.trim().length > 10) e.code = 'Máximo 10 caracteres';
    if (!formData.email.trim()) e.email = 'El correo es requerido';
    else if (!formData.email.trim().toLowerCase().endsWith('@academia.umb.edu.co')) e.email = 'El correo debe terminar en @academia.umb.edu.co';
    if (!formData.password) e.password = 'La contraseña es requerida';
    else if (formData.password.length < 8) e.password = 'Mínimo 8 caracteres';
    else if (!/[A-Z]/.test(formData.password)) e.password = 'Incluya mayúscula';
    else if (!/[a-z]/.test(formData.password)) e.password = 'Incluya minúscula';
    else if (!/[0-9]/.test(formData.password)) e.password = 'Incluya número';
    else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) e.password = 'Incluya carácter especial';
    if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';
    if (!formData.acceptTerms) e.acceptTerms = 'Debe aceptar los Términos y Condiciones';
    if (!formData.acceptPrivacy) e.acceptPrivacy = 'Debe aceptar la Política de Privacidad';
    if (!formData.consentBiometric) e.consentBiometric = 'Debe autorizar el tratamiento de datos biométricos';
    if (!photoBase64) e.photo = 'La foto es requerida';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        throw new Error('Permiso de cámara denegado');
      }

      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.7,
      });

      if (result.canceled) return;
      const asset = Array.isArray(result.assets) ? result.assets[0] : null;
      const b64 = asset?.base64 ? String(asset.base64) : '';
      if (!b64) {
        throw new Error('No se pudo obtener la foto en Base64');
      }

      setPhotoBase64(b64);
      setErrors((p) => {
        const next = { ...(p || {}) };
        delete next.photo;
        return next;
      });
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    }
  };

  const submit = async () => {
    if (!validate()) return;
    if (!REGISTER_STUDENT_URL) {
      Alert.alert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await fetch(REGISTER_STUDENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentCode: formData.code.trim(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: 'student',
          imageBase64: photoBase64,
          acceptTerms: formData.acceptTerms,
          acceptPrivacy: formData.acceptPrivacy,
          consentBiometric: formData.consentBiometric,
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
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      Alert.alert('Listo', 'Cuenta creada');
      navigation.replace('Login');
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Crear Cuenta</Text>
          <Text style={styles.headerSubtitle}>Complete sus datos</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Input
          label="Nombres"
          placeholder="Ingrese sus nombres"
          value={formData.firstName}
          onChangeText={(v) => setFormData((p) => ({ ...p, firstName: v }))}
          error={errors.firstName}
          autoCapitalize="words"
        />

        <View style={{ height: 14 }} />

        <Input
          label="Apellidos"
          placeholder="Ingrese sus apellidos"
          value={formData.lastName}
          onChangeText={(v) => setFormData((p) => ({ ...p, lastName: v }))}
          error={errors.lastName}
          autoCapitalize="words"
        />

        <View style={{ height: 14 }} />

        <Input
          label="Código Estudiantil"
          placeholder="Ingrese su código"
          value={formData.code}
          onChangeText={(v) => setFormData((p) => ({ ...p, code: v }))}
          error={errors.code}
          helperText="Código de 8 a 10 dígitos"
          autoCapitalize="none"
        />

        <View style={{ height: 14 }} />

        <Input
          label="Correo Electrónico"
          placeholder="usuario@academia.umb.edu.co"
          value={formData.email}
          onChangeText={(v) => setFormData((p) => ({ ...p, email: v }))}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={{ height: 14 }} />

        <Input
          label="Contraseña"
          placeholder="Mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial"
          value={formData.password}
          onChangeText={(v) => setFormData((p) => ({ ...p, password: v }))}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
        />

        <View style={{ height: 14 }} />

        <Input
          label="Confirmar Contraseña"
          placeholder="Repita su contraseña"
          value={formData.confirmPassword}
          onChangeText={(v) => setFormData((p) => ({ ...p, confirmPassword: v }))}
          error={errors.confirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <View style={{ height: 14 }} />

        <View style={styles.checkRow}>
          <View style={styles.checkLabelRow}>
            <Bot size={16} color={COLORS.blue} />
            <Text style={styles.checkLabelText}>No soy un robot</Text>
          </View>
          <Switch
            value={!!formData.isNotRobot}
            onValueChange={(v) => setFormData((p) => ({ ...p, isNotRobot: v }))}
          />
        </View>
        {errors.isNotRobot ? <Text style={styles.errorText}>{errors.isNotRobot}</Text> : null}

        <View style={{ height: 12 }} />

        <View style={styles.checkRow}>
          <Text style={styles.consentText}>
            He leído y acepto los{' '}
            <Text style={styles.consentLink} onPress={() => setShowTermsModal(true)}>
              Términos y Condiciones
            </Text>
          </Text>
          <Switch
            value={!!formData.acceptTerms}
            onValueChange={(v) => setFormData((p) => ({ ...p, acceptTerms: v }))}
          />
        </View>
        {errors.acceptTerms ? <Text style={styles.errorText}>{errors.acceptTerms}</Text> : null}

        <View style={{ height: 12 }} />

        <View style={styles.checkRow}>
          <Text style={styles.consentText}>
            He leído y acepto la{' '}
            <Text style={styles.consentLink} onPress={() => setShowPrivacyModal(true)}>
              Política de Privacidad
            </Text>
          </Text>
          <Switch
            value={!!formData.acceptPrivacy}
            onValueChange={(v) => setFormData((p) => ({ ...p, acceptPrivacy: v }))}
          />
        </View>
        {errors.acceptPrivacy ? <Text style={styles.errorText}>{errors.acceptPrivacy}</Text> : null}

        <View style={{ height: 12 }} />

        <View style={styles.checkRow}>
          <Text style={styles.consentText}>
            Autorizo el tratamiento de mis datos biométricos{' '}
            <Text style={styles.consentLink} onPress={() => setShowBiometricModal(true)}>
              (ver detalles)
            </Text>
          </Text>
          <Switch
            value={!!formData.consentBiometric}
            onValueChange={(v) => setFormData((p) => ({ ...p, consentBiometric: v }))}
          />
        </View>
        {errors.consentBiometric ? <Text style={styles.errorText}>{errors.consentBiometric}</Text> : null}
        <Text style={styles.consentHint}>
          Obligatorio. Los datos biométricos son sensibles y se usan solo para verificar tu identidad en asistencia.
        </Text>

        <View style={{ height: 14 }} />

        {/* ── Foto biométrica ── */}
        <View style={styles.photoSection}>
          <Text style={styles.photoLabel}>Foto para reconocimiento facial *</Text>
          {photoBase64 ? (
            /* Estado: foto tomada */
            <View style={styles.photoSuccess}>
              <View style={styles.photoSuccessIcon}>
                <CheckCircle2 size={32} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoSuccessTitle}>Foto registrada</Text>
                <Text style={styles.photoSuccessHint}>Tu foto se usará para el reconocimiento facial</Text>
              </View>
              <Pressable onPress={takePhoto} style={styles.retakeBtn}>
                <Camera size={16} color={COLORS.primary} />
                <Text style={styles.retakeBtnText}>Cambiar</Text>
              </Pressable>
            </View>
          ) : (
            /* Estado: sin foto */
            <Pressable style={styles.photoEmpty} onPress={takePhoto}>
              <View style={styles.photoEmptyIcon}>
                <Camera size={36} color={COLORS.primary} />
              </View>
              <Text style={styles.photoEmptyTitle}>Tomar foto</Text>
              <Text style={styles.photoEmptyHint}>
                Necesitas una foto clara de tu rostro{'\n'}para registrarte en el sistema biométrico
              </Text>
              <View style={styles.photoEmptyBtn}>
                <Camera size={16} color="#fff" />
                <Text style={styles.photoEmptyBtnText}>Abrir cámara</Text>
              </View>
            </Pressable>
          )}
          {errors.photo ? <Text style={styles.errorText}>{errors.photo}</Text> : null}
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button fullWidth size="lg" isLoading={isSubmitting} onPress={submit}>
          Registrar Cuenta
        </Button>
        <Text style={styles.loginHint}>
          ¿Ya tiene cuenta?{' '}
          <Text style={styles.loginLink} onPress={() => navigation.replace('Login')}>
            Iniciar sesión
          </Text>
        </Text>
      </View>

      <TermsAndConditionsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setFormData((p) => ({ ...p, acceptTerms: true }));
          setShowTermsModal(false);
        }}
      />

      <PrivacyPolicyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onAccept={() => {
          setFormData((p) => ({ ...p, acceptPrivacy: true }));
          setShowPrivacyModal(false);
        }}
      />

      <BiometricConsentModal
        visible={showBiometricModal}
        onClose={() => setShowBiometricModal(false)}
        onAccept={() => {
          setFormData((p) => ({ ...p, consentBiometric: true }));
          setShowBiometricModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 12, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: '#6B7280' },
  body: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    paddingBottom: 18,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 18,
    marginBottom: 14,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  checkLabelText: { color: '#374151', fontWeight: '700' },
  consentText: { flex: 1, color: '#374151', fontSize: 14, lineHeight: 20 },
  consentLink: { color: COLORS.primary, fontWeight: '800' },
  consentHint: { marginTop: 4, color: '#6B7280', fontSize: 12, fontStyle: 'italic' },
  errorText: { marginTop: 6, color: '#EF4444' },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  loginHint: { marginTop: 12, textAlign: 'center', color: '#6B7280' },
  loginLink: { color: COLORS.primary, fontWeight: '800' },
  // ── Foto ──
  photoSection: { marginBottom: 4 },
  photoLabel: { fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 8 },
  photoEmpty: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(185,28,28,0.03)',
  },
  photoEmptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(185,28,28,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  photoEmptyTitle: { fontSize: 17, fontWeight: '900', color: '#111827', marginBottom: 6 },
  photoEmptyHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  photoEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
  },
  photoEmptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  photoSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    padding: 14,
  },
  photoSuccessIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSuccessTitle: { fontWeight: '900', color: '#15803D', fontSize: 15 },
  photoSuccessHint: { marginTop: 3, fontSize: 12, color: '#166534' },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#fff',
  },
  retakeBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },
});
