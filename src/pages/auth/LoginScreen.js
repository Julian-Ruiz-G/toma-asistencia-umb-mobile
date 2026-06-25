import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ArrowLeft, KeyRound, LogIn } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../state/auth';
import { LOGIN_ADMIN_URL, LOGIN_STUDENT_URL, LOGIN_TEACHER_URL } from '../../config';
import { COLORS } from '../../ui/theme';

export default function LoginScreen({ navigation }) {
  const { setAuthToken, setRole, setEmail, setStudentCode, setTeacherCode } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberSession: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!String(formData.email || '').trim()) newErrors.email = 'El usuario o correo es requerido';
    if (!String(formData.password || '').trim()) newErrors.password = 'La contraseña es requerida';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const e = String(formData.email || '').trim().toLowerCase();
    if (!LOGIN_STUDENT_URL || !LOGIN_TEACHER_URL) {
      Alert.alert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }

    setIsLoading(true);
    try {
      const password = String(formData.password || '').trim();

      const tryLogin = async (url, body) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const text = await resp.text();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }
        return { resp, json, text };
      };

      // Single login form.
      // Attempt admin first (if endpoint configured), then student, then teacher.
      let r = null;
      if (LOGIN_ADMIN_URL) {
        r = await tryLogin(LOGIN_ADMIN_URL, { email: e, password });
      }
      if (!r || !r.resp.ok) {
        r = await tryLogin(LOGIN_STUDENT_URL, { email: e, password });
      }
      if (!r.resp.ok) {
        r = await tryLogin(LOGIN_TEACHER_URL, { email: e, password });
      }
      if (!r.resp.ok) {
        const msg = (r.json && (r.json.error || r.json.message || r.json.details)) || r.text || `HTTP ${r.resp.status}`;
        throw new Error(msg);
      }

      const token = r.json?.authToken || '';
      const role = r.json?.role || '';
      if (!token) throw new Error('authToken inválido');
      if (role !== 'teacher' && role !== 'student' && role !== 'admin') throw new Error('role inválido');

      setAuthToken(token);
      setRole(role);
      setEmail(e);

      // Reset role-specific codes for admin sessions
      if (role === 'admin') {
        setStudentCode('');
        setTeacherCode('');
      }

      navigation.reset({
        index: 0,
        routes: [{
          name: role === 'teacher' ? 'TeacherHome' : role === 'admin' ? 'AdminDashboard' : 'StudentHome'
        }],
      });
    } catch (err) {
      Alert.alert('Error', err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Iniciar Sesión</Text>
          <Text style={styles.headerSubtitle}>Bienvenido de nuevo</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.hero}>
          <View style={styles.logoGlow} />
          <View style={styles.logoWrap}>
              <Image
                source={require('../../../assets/escudo_umb.png')}
                style={styles.logo}
              />
          </View>

          <Text style={styles.title}>Asistencia inteligente</Text>
          <Text style={styles.subtitle}>Sistema de control de asistencia</Text>
        </View>

        <View>
          <Input
            label="Usuario o Correo"
            placeholder="Ingrese su usuario o correo"
            value={formData.email}
            onChangeText={(v) => setFormData((p) => ({ ...p, email: v }))}
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
          />

          <View style={{ height: 14 }} />

          <Input
            label="Contraseña"
            placeholder="Ingrese su contraseña"
            value={formData.password}
            onChangeText={(v) => setFormData((p) => ({ ...p, password: v }))}
            secureTextEntry
            autoCapitalize="none"
            error={errors.password}
          />

          <View style={styles.rememberRow}>
            <View style={styles.rememberLeft}>
              <Switch
                value={!!formData.rememberSession}
                onValueChange={(v) => setFormData((p) => ({ ...p, rememberSession: v }))}
              />
              <Text style={styles.rememberText}>Recordar sesión</Text>
            </View>

            <Pressable onPress={() => Alert.alert('Pendiente', 'Recuperación de contraseña')}>
              <Text style={styles.forgot}>¿Olvidó su contraseña?</Text>
            </Pressable>
          </View>

          <View style={{ height: 16 }} />

          <Button fullWidth size="lg" onPress={handleSubmit} isLoading={isLoading}>
            Ingresar
          </Button>

          <Text style={styles.registerText}>
            ¿No tiene cuenta?{' '}
            <Text style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
              Regístrese aquí
            </Text>
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <KeyRound size={16} color="#9CA3AF" />
          <Text style={styles.footerText}>Conexión segura SSL</Text>
        </View>
      </View>
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
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 26, paddingBottom: 18 },
  hero: { alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  logoGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(185, 28, 28, 0.10)',
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    overflow: 'hidden',
  },
  logo: { width: 64, height: 64, resizeMode: 'contain' },
  title: { marginTop: 18, fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  rememberLeft: { flexDirection: 'row', alignItems: 'center' },
  rememberText: { marginLeft: 10, fontSize: 14, color: '#4B5563' },
  forgot: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
  registerText: { marginTop: 16, textAlign: 'center', color: '#6B7280' },
  registerLink: { color: COLORS.primary, fontWeight: '700' },
  footer: { paddingHorizontal: 24, paddingVertical: 14, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  footerText: { marginLeft: 8, fontSize: 12, color: '#9CA3AF' },
});
