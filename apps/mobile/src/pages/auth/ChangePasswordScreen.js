import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, KeyRound } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { CHANGE_PASSWORD_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { appAlert } from '../../ui/appNotice';
import { useColors } from '../../ui/ThemeContext';
import { homeRouteForRole, passwordIssue } from '../../utils/passwordRules';
import { loadPersistedSession } from '../../utils/sessionStore';

export default function ChangePasswordScreen({ navigation, route }) {
  const forced = route?.params?.forced === true;
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken, role, logout, setMustChangePassword, persistSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const leave = useCallback(() => {
    if (forced) return;
    if (navigation.canGoBack()) navigation.goBack();
  }, [forced, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (!forced) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, [forced])
  );

  const submit = async () => {
    setError('');
    if (!currentPassword.trim() || !newPassword || !confirmPassword) {
      setError('Completa la contraseña actual, la nueva y la confirmación.');
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
    if (!CHANGE_PASSWORD_URL || !authToken) {
      setError('No hay sesión activa. Vuelve a iniciar sesión.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(CHANGE_PASSWORD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword,
        }),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        throw new Error((json && (json.message || json.error)) || text || `HTTP ${resp.status}`);
      }
      setMustChangePassword(false);
      const saved = await loadPersistedSession();
      if (saved) await persistSession({ ...saved, mustChangePassword: false });
      if (forced) {
        navigation.reset({ index: 0, routes: [{ name: homeRouteForRole(role) }] });
      } else {
        appAlert('Contraseña actualizada', 'La próxima vez entra con la nueva contraseña.');
        navigation.goBack();
      }
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {forced ? <View style={styles.backBtn} /> : (
          <Pressable onPress={leave} style={styles.backBtn}>
            <ArrowLeft size={24} color={COLORS.textSecondary} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{forced ? 'Nueva contraseña' : 'Cambiar contraseña'}</Text>
          <Text style={styles.headerSubtitle}>
            {forced
              ? 'La contraseña temporal debe cambiarse antes de continuar.'
              : 'Usa la contraseña actual para elegir otra.'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <KeyRound size={22} color={COLORS.primary} />
          </View>
          <Input
            label="Contraseña actual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="La que usas ahora"
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
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button fullWidth size="lg" onPress={submit} isLoading={loading}>
            Guardar contraseña
          </Button>
          {forced ? (
            <Pressable
              onPress={() => {
                logout();
                navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
              }}
              style={styles.logoutBtn}
            >
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </Pressable>
          ) : null}
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
  error: { marginBottom: 12, color: COLORS.danger, fontWeight: '700' },
  logoutBtn: { marginTop: 16, alignItems: 'center' },
  logoutText: { color: COLORS.dangerStrong, fontWeight: '800' },
});
