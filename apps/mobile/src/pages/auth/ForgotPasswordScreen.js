import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, KeyRound } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { FORGOT_PASSWORD_URL, RESET_PASSWORD_URL } from '../../config';
import { appAlert } from '../../ui/appNotice';
import { useColors } from '../../ui/ThemeContext';
import { passwordIssue } from '../../utils/passwordRules';

export default function ForgotPasswordScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    setError('');
    setInfo('');
    const address = email.trim().toLowerCase();
    if (!address || !address.includes('@')) {
      setError('Escribe el correo de la cuenta.');
      return;
    }
    if (!FORGOT_PASSWORD_URL) {
      setError('La API no está configurada.');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(FORGOT_PASSWORD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address }),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        throw new Error((json && (json.message || json.error)) || text || `HTTP ${resp.status}`);
      }
      setEmail(address);
      setInfo(json?.message || 'Si el correo está registrado, enviamos un código.');
      setStep('code');
    } catch (e) {
      setError(e?.message || 'No se pudo enviar el código.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setError('');
    if (!code.trim() || !newPassword || !confirmPassword) {
      setError('Escribe el código, la nueva contraseña y la confirmación.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    const issue = passwordIssue(newPassword);
    if (issue) {
      setError(issue);
      return;
    }
    if (!RESET_PASSWORD_URL) {
      setError('La API no está configurada.');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(RESET_PASSWORD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: code.trim(),
          newPassword,
        }),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        throw new Error((json && (json.message || json.error)) || text || `HTTP ${resp.status}`);
      }
      appAlert('Contraseña actualizada', json?.message || 'Ya puedes iniciar sesión.');
      navigation.goBack();
    } catch (e) {
      setError(e?.message || 'No se pudo restablecer la contraseña.');
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
          <Text style={styles.headerTitle}>Olvidé mi contraseña</Text>
          <Text style={styles.headerSubtitle}>
            {step === 'email' ? 'Te enviamos un código al correo de la cuenta.' : 'El código vence en 15 minutos.'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <KeyRound size={22} color={COLORS.primary} />
          </View>
          {step === 'email' ? (
            <Input
              label="Correo"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="correo@academia.umb.edu.co"
            />
          ) : (
            <>
              <Input
                label="Código"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="6 dígitos"
              />
              <Input
                label="Nueva contraseña"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Mínimo 8 caracteres"
              />
              <Input
                label="Confirmar nueva contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Repite la nueva contraseña"
              />
              <Text style={styles.hint}>Incluye mayúscula, minúscula, número y un símbolo.</Text>
            </>
          )}
          {info ? <Text style={styles.info}>{info}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            fullWidth
            size="lg"
            onPress={step === 'email' ? requestCode : resetPassword}
            isLoading={loading}
          >
            {step === 'email' ? 'Enviar código' : 'Guardar contraseña'}
          </Button>
        </View>
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
    marginBottom: 14,
  },
  hint: { marginBottom: 12, color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  info: { marginBottom: 12, color: COLORS.textSecondary, fontWeight: '600' },
  error: { marginBottom: 12, color: COLORS.danger, fontWeight: '700' },
});
