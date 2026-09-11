import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import RobotCaptcha from '../../components/RobotCaptcha';
import { COLORS } from '../../ui/theme';
import { REGISTER_STUDENT_URL, VALIDATE_REGISTER_PHOTO_URL } from '../../config';
import TermsAndConditionsModal from '../../components/TermsAndConditions';
import PrivacyPolicyModal from '../../components/PrivacyPolicy';
import BiometricConsentModal from '../../components/BiometricConsent';

const SPECIAL_RE = /[!@#$%^&*(),.?":{}|<>]/;

const PHOTO_TIPS = [
  'Un solo rostro, de frente',
  'Cara completa: frente, ojos, nariz y mentón',
  'Ojos abiertos, sin gafas ni gafas de sol',
  'Buena luz, sin recortes ni borrosidad',
];

function passwordChecks(password) {
  return [
    { key: 'len', label: 'Mínimo 8 caracteres', ok: password.length >= 8 },
    { key: 'upper', label: 'Al menos una letra mayúscula', ok: /[A-Z]/.test(password) },
    { key: 'lower', label: 'Al menos una letra minúscula', ok: /[a-z]/.test(password) },
    { key: 'num', label: 'Al menos un número', ok: /[0-9]/.test(password) },
    { key: 'special', label: 'Al menos un carácter especial (!@#$%…)', ok: SPECIAL_RE.test(password) },
    { key: 'space', label: 'Sin espacios', ok: password.length > 0 && !/\s/.test(password) },
  ];
}

function FieldMessage({ text }) {
  if (!text) return null;
  return (
    <View style={styles.fieldError}>
      <CircleAlert size={15} color="#B91C1C" />
      <Text style={styles.fieldErrorText}>{text}</Text>
    </View>
  );
}

function formatRegisterError(json, text, status) {
  if (Array.isArray(json?.issues) && json.issues.length) {
    return json.issues.join('\n• ');
  }
  const code = String(json?.error || '');
  const mapped = {
    TermsNotAccepted: 'Debes aceptar los Términos y Condiciones.',
    PrivacyNotAccepted: 'Debes aceptar la Política de Privacidad.',
    BiometricConsentNotAccepted: 'Debes autorizar el tratamiento de datos biométricos.',
    StudentCodeAlreadyRegistered: 'Ese código estudiantil ya está registrado.',
    FaceAlreadyRegistered: 'Este rostro ya está registrado en otra cuenta.',
    InvalidEmailDomain: 'El correo debe terminar en @academia.umb.edu.co.',
    PasswordTooShort: 'La contraseña debe tener mínimo 8 caracteres.',
    PasswordMissingUppercase: 'Falta una letra mayúscula en la contraseña.',
    PasswordMissingLowercase: 'Falta una letra minúscula en la contraseña.',
    PasswordMissingNumber: 'Falta un número en la contraseña.',
    PasswordMissingSpecial: 'Falta un carácter especial en la contraseña.',
    CaptchaFailed: 'Completa de nuevo la verificación de que no eres un robot.',
    CaptchaInvalid: 'Completa la verificación de que no eres un robot.',
    CaptchaTooFast: 'Responde el captcha con calma e inténtalo de nuevo.',
    StudentCodeTooShort: 'El código estudiantil debe tener mínimo 8 caracteres.',
    StudentCodeTooLong: 'El código estudiantil debe tener máximo 10 caracteres.',
  };
  if (json?.message) return String(json.message);
  if (mapped[code]) return mapped[code];
  if (code && !code.includes(' ')) return mapped[code] || `No se pudo completar el registro (${code}).`;
  if (code) return code;
  if (text) return String(text).slice(0, 280);
  return `No se pudo completar el registro (HTTP ${status || '?'}).`;
}

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
  const [formAlert, setFormAlert] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingPhoto, setIsCheckingPhoto] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [captchaProof, setCaptchaProof] = useState(null);

  const pwRules = useMemo(() => passwordChecks(formData.password), [formData.password]);
  const passwordReady = pwRules.every((r) => r.ok);
  const passwordsMatch =
    formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword;

  const validate = () => {
    const e = {};

    if (!formData.firstName.trim()) e.firstName = 'Escribe tu nombre.';
    else if (formData.firstName.trim().length < 2) e.firstName = 'El nombre debe tener al menos 2 letras.';
    else if (formData.firstName.trim().length > 50) e.firstName = 'El nombre no puede pasar de 50 caracteres.';
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(formData.firstName.trim())) {
      e.firstName = 'El nombre solo puede incluir letras y espacios.';
    }

    if (!formData.lastName.trim()) e.lastName = 'Escribe tus apellidos.';
    else if (formData.lastName.trim().length < 2) e.lastName = 'Los apellidos deben tener al menos 2 letras.';
    else if (formData.lastName.trim().length > 50) e.lastName = 'Los apellidos no pueden pasar de 50 caracteres.';
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(formData.lastName.trim())) {
      e.lastName = 'Los apellidos solo pueden incluir letras y espacios.';
    }

    if (!formData.code.trim()) e.code = 'Escribe tu código estudiantil.';
    else if (formData.code.trim().length < 8) e.code = 'El código debe tener mínimo 8 caracteres.';
    else if (formData.code.trim().length > 10) e.code = 'El código debe tener máximo 10 caracteres.';

    if (!formData.email.trim()) e.email = 'Escribe tu correo institucional.';
    else if (!formData.email.trim().toLowerCase().endsWith('@academia.umb.edu.co')) {
      e.email = 'Usa tu correo @academia.umb.edu.co.';
    }

    if (!formData.password) e.password = 'Crea una contraseña.';
    else if (!passwordReady) e.password = 'La contraseña aún no cumple todas las reglas.';
    if (!formData.confirmPassword) e.confirmPassword = 'Confirma tu contraseña.';
    else if (formData.password !== formData.confirmPassword) {
      e.confirmPassword = 'Las contraseñas no coinciden.';
    }

    if (!formData.isNotRobot || !captchaProof) e.isNotRobot = 'Completa la verificación de que no eres un robot.';
    if (!formData.acceptTerms) e.acceptTerms = 'Debes aceptar los Términos y Condiciones.';
    if (!formData.acceptPrivacy) e.acceptPrivacy = 'Debes aceptar la Política de Privacidad.';
    if (!formData.consentBiometric) {
      e.consentBiometric = 'Debes autorizar el tratamiento de datos biométricos.';
    }
    if (!photoBase64) e.photo = 'Toma una foto de tu rostro para el registro biométrico.';

    setErrors(e);
    if (Object.keys(e).length) {
      const first = Object.values(e)[0];
      setFormAlert(first);
      return false;
    }
    setFormAlert('');
    return true;
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Cámara', 'Necesitamos permiso de cámara para tomar tu foto de registro.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.75,
        allowsEditing: true,
        aspect: [3, 4],
        cameraType: ImagePicker.CameraType?.front,
      });

      if (result.canceled) return;
      const asset = Array.isArray(result.assets) ? result.assets[0] : null;
      const b64 = asset?.base64 ? String(asset.base64) : '';
      if (!b64) {
        Alert.alert('Foto', 'No se pudo leer la imagen. Intenta otra vez.');
        return;
      }

      const w = Number(asset?.width || 0);
      const h = Number(asset?.height || 0);
      if ((w && w < 240) || (h && h < 240)) {
        Alert.alert(
          'Foto demasiado pequeña',
          'La imagen no tiene suficiente resolución. Acércate, usa buena luz y toma otra foto.'
        );
        return;
      }

      if (!VALIDATE_REGISTER_PHOTO_URL) {
        setPhotoBase64(b64);
        setErrors((p) => {
          const next = { ...(p || {}) };
          delete next.photo;
          return next;
        });
        return;
      }

      setIsCheckingPhoto(true);
      try {
        const resp = await fetch(VALIDATE_REGISTER_PHOTO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: b64 }),
        });
        const raw = await resp.text();
        let json;
        try {
          json = JSON.parse(raw);
        } catch {
          json = null;
        }

        if (resp.status === 404 || resp.status === 403) {
          setPhotoBase64(b64);
          setErrors((p) => {
            const next = { ...(p || {}) };
            delete next.photo;
            return next;
          });
          Alert.alert(
            'Foto guardada',
            'No se pudo revisar el rostro ahora. Al registrar se volverá a comprobar que la cara esté completa.'
          );
          return;
        }

        const issues = Array.isArray(json?.issues) ? json.issues.filter(Boolean) : [];
        if (!resp.ok || json?.ok === false || issues.length) {
          const detail = issues.length
            ? issues.map((item, i) => `${i + 1}. ${item}`).join('\n\n')
            : formatRegisterError(json, raw, resp.status);
          Alert.alert(
            'Esta foto no sirve para el registro',
            `${detail}\n\nConsejo: encuadra toda la cara (frente, ojos, nariz y mentón), de frente y con buena luz.`
          );
          return;
        }

        setPhotoBase64(b64);
        setErrors((p) => {
          const next = { ...(p || {}) };
          delete next.photo;
          return next;
        });
        setFormAlert('');
      } finally {
        setIsCheckingPhoto(false);
      }
    } catch (e) {
      setIsCheckingPhoto(false);
      Alert.alert('Error al tomar la foto', e?.message || String(e));
    }
  };

  const submit = async () => {
    if (!validate()) return;
    if (!REGISTER_STUDENT_URL) {
      setFormAlert('La API no está configurada. Revisa extra.apiUrl en app.json.');
      return;
    }

    setIsSubmitting(true);
    setFormAlert('');
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
          captchaToken: captchaProof?.token || '',
          captchaAnswer: captchaProof?.answer,
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
        const msg = formatRegisterError(json, text, resp.status);
        setFormAlert(msg);
        if (Array.isArray(json?.issues) && json.issues.length) {
          Alert.alert(
            'La foto no cumple los requisitos',
            json.issues.map((item, i) => `${i + 1}. ${item}`).join('\n\n')
          );
        }
        return;
      }

      Alert.alert('Cuenta creada', 'Ya puedes iniciar sesión con tu correo y contraseña.');
      navigation.replace('Login');
    } catch (e) {
      setFormAlert(e?.message || 'No hay conexión. Intenta de nuevo.');
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
        {formAlert ? (
          <View style={styles.formAlert}>
            <CircleAlert size={18} color="#B91C1C" />
            <Text style={styles.formAlertText}>{formAlert}</Text>
          </View>
        ) : null}

        <Input
          label="Nombres"
          placeholder="Ingrese sus nombres"
          value={formData.firstName}
          onChangeText={(v) => {
            setFormData((p) => ({ ...p, firstName: v }));
            setErrors((p) => ({ ...p, firstName: undefined }));
          }}
          error={errors.firstName}
          autoCapitalize="words"
        />

        <View style={{ height: 14 }} />

        <Input
          label="Apellidos"
          placeholder="Ingrese sus apellidos"
          value={formData.lastName}
          onChangeText={(v) => {
            setFormData((p) => ({ ...p, lastName: v }));
            setErrors((p) => ({ ...p, lastName: undefined }));
          }}
          error={errors.lastName}
          autoCapitalize="words"
        />

        <View style={{ height: 14 }} />

        <Input
          label="Código Estudiantil"
          placeholder="Ingrese su código"
          value={formData.code}
          onChangeText={(v) => {
            setFormData((p) => ({ ...p, code: v }));
            setErrors((p) => ({ ...p, code: undefined }));
          }}
          error={errors.code}
          helperText="Código de 8 a 10 caracteres"
          autoCapitalize="none"
        />

        <View style={{ height: 14 }} />

        <Input
          label="Correo Electrónico"
          placeholder="usuario@academia.umb.edu.co"
          value={formData.email}
          onChangeText={(v) => {
            setFormData((p) => ({ ...p, email: v }));
            setErrors((p) => ({ ...p, email: undefined }));
          }}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={{ height: 14 }} />

        <Input
          label="Contraseña"
          placeholder="Crea tu contraseña"
          value={formData.password}
          onChangeText={(v) => {
            setFormData((p) => ({ ...p, password: v }));
            setErrors((p) => ({ ...p, password: undefined }));
          }}
          error={errors.password}
          hideErrorText
          secureTextEntry
          autoCapitalize="none"
        />

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>Tu contraseña debe cumplir:</Text>
          {pwRules.map((rule) => (
            <View key={rule.key} style={styles.ruleRow}>
              <View style={[styles.ruleIcon, rule.ok ? styles.ruleIconOk : styles.ruleIconWait]}>
                {rule.ok ? <Check size={12} color="#fff" strokeWidth={3} /> : <X size={12} color="#9CA3AF" strokeWidth={3} />}
              </View>
              <Text style={[styles.ruleText, rule.ok ? styles.ruleTextOk : styles.ruleTextWait]}>
                {rule.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 14 }} />

        <Input
          label="Confirmar Contraseña"
          placeholder="Repite tu contraseña"
          value={formData.confirmPassword}
          onChangeText={(v) => {
            setFormData((p) => ({ ...p, confirmPassword: v }));
            setErrors((p) => ({ ...p, confirmPassword: undefined }));
          }}
          error={errors.confirmPassword}
          hideErrorText={!!formData.confirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        {formData.confirmPassword ? (
          <View style={[styles.matchRow, passwordsMatch ? styles.matchOk : styles.matchBad]}>
            {passwordsMatch ? (
              <CheckCircle2 size={16} color="#15803D" />
            ) : (
              <CircleAlert size={16} color="#B91C1C" />
            )}
            <Text style={[styles.matchText, passwordsMatch ? styles.matchTextOk : styles.matchTextBad]}>
              {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
            </Text>
          </View>
        ) : null}

        <View style={{ height: 14 }} />

        <RobotCaptcha
          checked={!!formData.isNotRobot}
          error={!!errors.isNotRobot}
          onChange={(ok, proof) => {
            setFormData((p) => ({ ...p, isNotRobot: ok }));
            setCaptchaProof(ok ? proof : null);
            setErrors((p) => ({ ...p, isNotRobot: undefined }));
          }}
        />
        <FieldMessage text={errors.isNotRobot} />

        <View style={{ height: 12 }} />

        <View style={[styles.checkRow, errors.acceptTerms ? styles.checkRowError : null]}>
          <Text style={styles.consentText}>
            He leído y acepto los{' '}
            <Text style={styles.consentLink} onPress={() => setShowTermsModal(true)}>
              Términos y Condiciones
            </Text>
          </Text>
          <Switch
            value={!!formData.acceptTerms}
            onValueChange={(v) => {
              setFormData((p) => ({ ...p, acceptTerms: v }));
              setErrors((p) => ({ ...p, acceptTerms: undefined }));
            }}
          />
        </View>
        <FieldMessage text={errors.acceptTerms} />

        <View style={{ height: 12 }} />

        <View style={[styles.checkRow, errors.acceptPrivacy ? styles.checkRowError : null]}>
          <Text style={styles.consentText}>
            He leído y acepto la{' '}
            <Text style={styles.consentLink} onPress={() => setShowPrivacyModal(true)}>
              Política de Privacidad
            </Text>
          </Text>
          <Switch
            value={!!formData.acceptPrivacy}
            onValueChange={(v) => {
              setFormData((p) => ({ ...p, acceptPrivacy: v }));
              setErrors((p) => ({ ...p, acceptPrivacy: undefined }));
            }}
          />
        </View>
        <FieldMessage text={errors.acceptPrivacy} />

        <View style={{ height: 12 }} />

        <View style={[styles.checkRow, errors.consentBiometric ? styles.checkRowError : null]}>
          <Text style={styles.consentText}>
            Autorizo el tratamiento de mis datos biométricos{' '}
            <Text style={styles.consentLink} onPress={() => setShowBiometricModal(true)}>
              (ver detalles)
            </Text>
          </Text>
          <Switch
            value={!!formData.consentBiometric}
            onValueChange={(v) => {
              setFormData((p) => ({ ...p, consentBiometric: v }));
              setErrors((p) => ({ ...p, consentBiometric: undefined }));
            }}
          />
        </View>
        <FieldMessage text={errors.consentBiometric} />
        <Text style={styles.consentHint}>
          Obligatorio. Los datos biométricos son sensibles y se usan solo para verificar tu identidad en asistencia.
        </Text>

        <View style={{ height: 14 }} />

        <View style={styles.photoSection}>
          <Text style={styles.photoLabel}>Foto para reconocimiento facial *</Text>
          <View style={styles.photoTips}>
            {PHOTO_TIPS.map((tip) => (
              <Text key={tip} style={styles.photoTip}>
                • {tip}
              </Text>
            ))}
          </View>
          {photoBase64 ? (
            <View style={styles.photoSuccess}>
              <View style={styles.photoSuccessIcon}>
                <CheckCircle2 size={32} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoSuccessTitle}>Foto válida</Text>
                <Text style={styles.photoSuccessHint}>El rostro cumple las reglas del registro</Text>
              </View>
              <Pressable onPress={takePhoto} style={styles.retakeBtn} disabled={isCheckingPhoto}>
                <Camera size={16} color={COLORS.primary} />
                <Text style={styles.retakeBtnText}>Cambiar</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.photoEmpty} onPress={takePhoto} disabled={isCheckingPhoto}>
              <View style={styles.photoEmptyIcon}>
                {isCheckingPhoto ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <Camera size={36} color={COLORS.primary} />
                )}
              </View>
              <Text style={styles.photoEmptyTitle}>
                {isCheckingPhoto ? 'Revisando tu foto…' : 'Tomar foto'}
              </Text>
              <Text style={styles.photoEmptyHint}>
                Encaja toda la cara en el recuadro.{'\n'}Si solo se ve la mitad, la app te pedirá otra.
              </Text>
              <View style={styles.photoEmptyBtn}>
                <Camera size={16} color="#fff" />
                <Text style={styles.photoEmptyBtnText}>Abrir cámara</Text>
              </View>
            </Pressable>
          )}
          <FieldMessage text={errors.photo} />
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button fullWidth size="lg" isLoading={isSubmitting || isCheckingPhoto} onPress={submit}>
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
  formAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  formAlertText: { flex: 1, color: '#991B1B', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  rulesCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rulesTitle: { fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 8 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  ruleIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleIconOk: { backgroundColor: '#16A34A' },
  ruleIconWait: { backgroundColor: '#E5E7EB' },
  ruleText: { flex: 1, fontSize: 13, lineHeight: 18 },
  ruleTextOk: { color: '#15803D', fontWeight: '700' },
  ruleTextWait: { color: '#6B7280' },
  matchRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  matchOk: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  matchBad: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  matchText: { flex: 1, fontSize: 13, fontWeight: '700' },
  matchTextOk: { color: '#15803D' },
  matchTextBad: { color: '#B91C1C' },
  fieldError: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fieldErrorText: { flex: 1, color: '#B91C1C', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  checkRowError: { backgroundColor: '#FEF2F2' },
  checkLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  checkLabelText: { color: '#374151', fontWeight: '700' },
  consentText: { flex: 1, color: '#374151', fontSize: 14, lineHeight: 20 },
  consentLink: { color: COLORS.primary, fontWeight: '800' },
  consentHint: { marginTop: 4, color: '#6B7280', fontSize: 12, fontStyle: 'italic' },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  loginHint: { marginTop: 12, textAlign: 'center', color: '#6B7280' },
  loginLink: { color: COLORS.primary, fontWeight: '800' },
  photoSection: { marginBottom: 4 },
  photoLabel: { fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 8 },
  photoTips: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  photoTip: { fontSize: 12, color: '#9A3412', lineHeight: 18, fontWeight: '600' },
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
