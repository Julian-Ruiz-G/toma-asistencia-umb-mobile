// Importaciones necesarias para el componente de perfil del estudiante
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
// Importación de íconos desde lucide-react-native
import {
  ArrowLeft,
  BookOpen,
  Camera,
  CheckCircle,
  ChevronRight,
  Edit3,
  Hash,
  LogOut,
  Mail,
  Shield,
  User,
} from 'lucide-react-native';

// Importaciones de componentes y configuración
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { COLORS } from '../../ui/theme';
import { useAuth } from '../../state/auth';
import { STUDENT_DAILY_SUMMARY_URL } from '../../config';
import { SET_CONSENT_URL } from '../../config';

// Componente principal del perfil del estudiante
export default function StudentProfile({ navigation }) {
  // Obtener datos de autenticación y setters desde el contexto
  const { email, logout, studentCode, setEmail, setStudentCode, authToken } = useAuth();
  // Estados locales del componente
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // Modal de confirmación de logout
  const [biometricConsent, setBiometricConsent] = useState(true); // Consentimiento biométrico
  const [showEdit, setShowEdit] = useState(false); // Modal de edición de perfil
  const [draftEmail, setDraftEmail] = useState(''); // Email temporal para edición
  const [draftStudentCode, setDraftStudentCode] = useState(''); // Código temporal para edición
  const [dailySummary, setDailySummary] = useState(null);

  // Efecto para sincronizar los campos de edición con los datos del contexto
  useEffect(() => {
    setDraftEmail(String(email || '')); // Sincronizar email
    setDraftStudentCode(String(studentCode || '')); // Sincronizar código de estudiante
  }, [email, studentCode]);

  useEffect(() => {
    (async () => {
      try {
        if (!authToken) return;
        if (!STUDENT_DAILY_SUMMARY_URL) return;

        const resp = await fetch(STUDENT_DAILY_SUMMARY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({}),
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
        setDailySummary(json);
      } catch (e) {
        Alert.alert('Error', e?.message || String(e));
      }
    })();
  }, [authToken]);

  // Objeto con datos del estudiante para mostrar en la UI
  const studentData = {
    name: email || 'Estudiante', // Nombre para mostrar (usa email como fallback)
    code: studentCode || '', // Código del estudiante
    email: email || '', // Email del estudiante
  };

  // Función para manejar el logout del estudiante
  const handleLogout = () => {
    setShowLogoutConfirm(false); // Cerrar modal de confirmación
    logout(); // Limpiar contexto de autenticación
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] }); // Resetear navegación a Welcome
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          <Text style={styles.headerSubtitle}>Información personal</Text>
        </View>
        <Pressable onPress={() => setShowEdit(true)} style={styles.iconBtn}>
          <Edit3 size={20} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Card style={[styles.card, { padding: 20 }]}
>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.photoWrap}>
              <View style={styles.photoGradient}>
                <User size={44} color="#fff" />
              </View>
              <Pressable onPress={() => Alert.alert('Pendiente', 'Cambiar foto')} style={styles.cameraBtn}>
                <Camera size={16} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.profileName}>{studentData.name}</Text>
            <Text style={styles.profileProgram}>{studentData.email || '—'}</Text>
            <View style={styles.activePill}>
              <CheckCircle size={16} color="#16A34A" />
              <Text style={styles.activeText}>Activo</Text>
            </View>
          </View>
        </Card>

        <View style={{ height: 14 }} />

        <Card style={[styles.card, { padding: 18 }]}>
          <Text style={styles.sectionTitle}>Información Personal</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Hash size={20} color="#4B5563" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Código Estudiantil</Text>
              <Text style={styles.infoValue}>{studentData.code || '—'}</Text>
            </View>
          </View>

          <View style={{ height: 14 }} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Mail size={20} color="#4B5563" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Correo Institucional</Text>
              <Text style={styles.infoValue}>{studentData.email}</Text>
            </View>
          </View>

          <View style={{ height: 12 }} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <BookOpen size={20} color="#4B5563" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Semestre</Text>
              <Text style={styles.infoValue}>—</Text>
            </View>
          </View>
        </Card>

        <View style={{ height: 14 }} />

        <Card style={[styles.card, { padding: 18 }]}>
          <View style={styles.consentHeader}>
            <View style={styles.consentLeft}>
              <View style={[styles.infoIcon, { backgroundColor: 'rgba(185,28,28,0.10)' }]}>
                <Shield size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Consentimiento Biométrico</Text>
                <Text style={styles.headerSubtitle}>Uso de reconocimiento facial</Text>
              </View>
            </View>
            <Pressable
              onPress={async () => {
                const next = !biometricConsent;
                setBiometricConsent(next);
                try {
                  if (!authToken) return;
                  if (!SET_CONSENT_URL) return;
                  const resp = await fetch(SET_CONSENT_URL, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({ biometricConsent: next }),
                  });
                  const text = await resp.text();
                  let json;
                  try { json = JSON.parse(text); } catch { json = null; }
                  if (!resp.ok) {
                    const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
                    throw new Error(msg);
                  }
                } catch (e) {
                  Alert.alert('Error', e?.message || String(e));
                }
              }}
              style={[styles.togglePill, biometricConsent ? styles.toggleOn : styles.toggleOff]}
            >
              <View style={[styles.toggleDot, biometricConsent ? styles.toggleDotOn : null]} />
            </Pressable>
          </View>

          <Text style={styles.consentText}>
            Autorizo el uso de mi información biométrica para fines de verificación de identidad y control de asistencia en el sistema de la Universidad Manuela Beltrán.
          </Text>
        </Card>

        <View style={{ height: 14 }} />

        <Pressable
          onPress={() => Alert.alert('Pendiente', 'Configuración de Privacidad')}
          style={[styles.card, styles.linkCard]}
        >
          <View style={styles.linkLeft}>
            <View style={[styles.infoIcon, { backgroundColor: '#DBEAFE' }]}>
              <Shield size={20} color="#2563EB" />
            </View>
            <Text style={styles.linkText}>Configuración de Privacidad</Text>
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
        </Pressable>

        <View style={{ height: 14 }} />

        <Pressable onPress={() => setShowLogoutConfirm(true)} style={[styles.card, styles.logoutCard]}>
          <LogOut size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </Pressable>

        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal visible={showLogoutConfirm} transparent animationType="fade" onRequestClose={() => setShowLogoutConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <LogOut size={28} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>¿Cerrar Sesión?</Text>
            <Text style={styles.modalText}>¿Estás seguro de que deseas cerrar tu sesión?</Text>
            <View style={{ height: 14 }} />
            <View style={styles.modalButtons}>
              <Button fullWidth variant="outline" onPress={() => setShowLogoutConfirm(false)}>
                Cancelar
              </Button>
              <View style={{ height: 10 }} />
              <Button fullWidth onPress={handleLogout}>
                Sí, cerrar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEdit} transparent animationType="fade" onRequestClose={() => setShowEdit(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar perfil</Text>
            <Text style={styles.modalText}>Actualiza tus datos locales del perfil.</Text>
            <View style={{ height: 14 }} />
            <Input label="Correo" value={draftEmail} onChangeText={setDraftEmail} autoCapitalize="none" keyboardType="email-address" />
            <View style={{ height: 12 }} />
            <Input label="Código estudiantil" value={draftStudentCode} onChangeText={setDraftStudentCode} autoCapitalize="none" />
            <View style={{ height: 14 }} />
            <Button fullWidth variant="outline" onPress={() => setShowEdit(false)}>
              Cancelar
            </Button>
            <View style={{ height: 10 }} />
            <Button
              fullWidth
              onPress={() => {
                // Función para guardar los cambios del perfil del estudiante
                const handleSaveEdit = () => {
                  setEmail(draftEmail); // Actualizar email en el contexto
                  setStudentCode(draftStudentCode); // Actualizar código en el contexto
                  setShowEdit(false); // Cerrar modal de edición
                  Alert.alert('Perfil actualizado', 'Tus datos han sido guardados localmente.');
                };
                handleSaveEdit();
              }}
            >
              Guardar
            </Button>
          </View>
        </View>
      </Modal>
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
  iconBtn: { padding: 10, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: '#6B7280' },
  body: { paddingHorizontal: 24, paddingVertical: 18, paddingBottom: 30 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  photoWrap: { width: 96, height: 96, marginTop: 2 },
  photoGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraBtn: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileName: { marginTop: 12, fontSize: 18, fontWeight: '900', color: '#111827', textAlign: 'center' },
  profileProgram: { marginTop: 4, color: '#6B7280' },
  activePill: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  activeText: { color: '#15803D', fontWeight: '800' },
  sectionTitle: { fontWeight: '900', color: '#1F2937' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 12, color: '#6B7280' },
  infoValue: { fontWeight: '800', color: '#1F2937', marginTop: 2 },
  consentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  consentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  consentText: { marginTop: 12, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, color: '#4B5563', lineHeight: 18 },
  togglePill: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleOff: { backgroundColor: '#E5E7EB' },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleDotOn: { alignSelf: 'flex-end' },
  linkCard: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkText: { fontWeight: '800', color: '#1F2937' },
  logoutCard: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  logoutText: { fontWeight: '900', color: '#DC2626' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 },
  modalIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 4 },
  modalTitle: { marginTop: 12, fontSize: 20, fontWeight: '900', textAlign: 'center', color: '#111827' },
  modalText: { marginTop: 6, textAlign: 'center', color: '#6B7280' },
  modalButtons: { marginTop: 8 },
});
