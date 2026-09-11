import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  GraduationCap,
  Hash,
  LogOut,
  Mail,
  Phone,
  Shield,
  User,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import TermsAndConditionsModal from '../../components/TermsAndConditions';
import PrivacyPolicyModal from '../../components/PrivacyPolicy';
import BiometricConsentModal from '../../components/BiometricConsent';
import { COLORS } from '../../ui/theme';
import { useAuth } from '../../state/auth';
import { UPDATE_MY_PROFILE_URL } from '../../config';
import { personDisplayName } from '../../utils/displayName';
import { isStudentProfileComplete, missingStudentProfileFields, studentProfileIncompleteMessage } from '../../utils/studentProfile';
import {
  copyLocalAvatar,
  loadLocalProfile,
  loadPersistedSession,
  saveLocalProfile,
  savePersistedSession,
} from '../../utils/sessionStore';

export default function StudentProfile({ navigation, route }) {
  const {
    email,
    logout,
    studentCode,
    authToken,
    fullName,
    setFullName,
    program,
    setProgram,
    semester,
    setSemester,
    phone,
    setPhone,
  } = useAuth();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null);
  const [localPhotoUri, setLocalPhotoUri] = useState('');
  const [saving, setSaving] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftProgram, setDraftProgram] = useState('');
  const [draftSemester, setDraftSemester] = useState('');
  const [draftPhone, setDraftPhone] = useState('');

  const profileSnapshot = { fullName, program, semester, phone };
  const profileIncomplete = !isStudentProfileComplete(profileSnapshot);
  const forceEdit = Boolean(route?.params?.forceEdit) || profileIncomplete;

  useEffect(() => {
    setDraftName(String(fullName || ''));
    setDraftProgram(String(program || ''));
    setDraftSemester(String(semester || ''));
    setDraftPhone(String(phone || ''));
  }, [fullName, program, semester, phone]);

  useEffect(() => {
    (async () => {
      const local = await loadLocalProfile(email);
      if (local?.photoUri) setLocalPhotoUri(String(local.photoUri));
      if (!program && local?.program) setProgram(String(local.program));
      if (!semester && local?.semester) setSemester(String(local.semester));
      if (!phone && local?.phone) setPhone(String(local.phone));
    })();
  }, [email]);

  useEffect(() => {
    if (forceEdit) setShowEdit(true);
  }, [forceEdit]);

  const displayName = personDisplayName(fullName, 'Estudiante');

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const persistAuthExtras = async (next) => {
    const saved = await loadPersistedSession();
    if (!saved?.authToken) return;
    await savePersistedSession({ ...saved, ...next });
  };

  const pickLocalPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'Autoriza el acceso a la galería para elegir una foto local.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      const dest = await copyLocalAvatar(email, uri);
      const finalUri = dest || uri;
      setLocalPhotoUri(finalUri);
      await saveLocalProfile(email, { photoUri: finalUri });
      Alert.alert(
        'Foto actualizada',
      );
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    }
  };

  const saveProfile = async () => {
    const nextName = String(draftName || '').trim();
    const nextProgram = String(draftProgram || '').trim();
    const nextSemester = String(draftSemester || '').trim();
    const nextPhone = String(draftPhone || '').trim();

    if (!nextName || !nextProgram || !nextSemester || !nextPhone) {
      const missing = missingStudentProfileFields({
        fullName: nextName,
        program: nextProgram,
        semester: nextSemester,
        phone: nextPhone,
      });
      Alert.alert('Datos obligatorios', `Llena estos campos: ${missing.join(', ')}.`);
      return;
    }

    setSaving(true);
    try {
      if (UPDATE_MY_PROFILE_URL && authToken) {
        const resp = await fetch(UPDATE_MY_PROFILE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            fullName: nextName,
            program: nextProgram,
            semester: nextSemester,
            phone: nextPhone,
          }),
        });
        const text = await resp.text();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }
        if (!resp.ok) {
          const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
          if (resp.status !== 404) {
            throw new Error(msg);
          }
        }
      }

      setFullName(nextName);
      setProgram(nextProgram);
      setSemester(nextSemester);
      setPhone(nextPhone);
      await saveLocalProfile(email, {
        program: nextProgram,
        semester: nextSemester,
        phone: nextPhone,
        fullName: nextName,
      });
      await persistAuthExtras({
        fullName: nextName,
        program: nextProgram,
        semester: nextSemester,
        phone: nextPhone,
      });
      setShowEdit(false);
      Alert.alert('Perfil actualizado', 'Tus datos académicos se guardaron. El correo y el código no se pueden cambiar aquí.');
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const menuLinks = [
    {
      label: 'Historial de asistencia',
      Icon: Clock,
      bg: '#FEE2E2',
      fg: COLORS.primary,
      onPress: () => navigation.navigate('StudentAttendanceHistory'),
    },
    {
      label: 'Horario de clases',
      Icon: Calendar,
      bg: '#DBEAFE',
      fg: '#2563EB',
      onPress: () => navigation.navigate('StudentSchedule'),
    },
    {
      label: 'Notificaciones',
      Icon: Bell,
      bg: '#FEF3C7',
      fg: '#D97706',
      onPress: () => navigation.navigate('StudentNotifications'),
    },
  ];

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
        <Card style={[styles.card, { padding: 20 }]}>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.photoWrap}>
              <View style={styles.photoGradient}>
                {localPhotoUri ? (
                  <Image source={{ uri: localPhotoUri }} style={styles.photoImg} />
                ) : (
                  <User size={44} color="#fff" />
                )}
              </View>
              <Pressable onPress={pickLocalPhoto} style={styles.cameraBtn}>
                <Camera size={16} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileProgram}>{program || email || '—'}</Text>
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
              <Text style={styles.infoValue}>{studentCode || '—'}</Text>
            </View>
          </View>

          <View style={{ height: 14 }} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Mail size={20} color="#4B5563" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Correo Institucional</Text>
              <Text style={styles.infoValue}>{email || '—'}</Text>
            </View>
          </View>

          <View style={{ height: 14 }} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <GraduationCap size={20} color="#4B5563" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Carrera / Programa</Text>
              <Text style={styles.infoValue}>{program || '—'}</Text>
            </View>
          </View>

          <View style={{ height: 14 }} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <BookOpen size={20} color="#4B5563" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Semestre</Text>
              <Text style={styles.infoValue}>{semester || '—'}</Text>
            </View>
          </View>

          <View style={{ height: 14 }} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Phone size={20} color="#4B5563" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Teléfono</Text>
              <Text style={styles.infoValue}>{phone || '—'}</Text>
            </View>
          </View>
        </Card>

        <View style={{ height: 14 }} />

        {menuLinks.map((item) => (
          <View key={item.label}>
            <Pressable onPress={item.onPress} style={[styles.card, styles.linkCard]}>
              <View style={styles.linkLeft}>
                <View style={[styles.infoIcon, { backgroundColor: item.bg }]}>
                  <item.Icon size={20} color={item.fg} />
                </View>
                <Text style={styles.linkText}>{item.label}</Text>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </Pressable>
            <View style={{ height: 10 }} />
          </View>
        ))}

        <Pressable onPress={() => setShowPrivacyMenu(true)} style={[styles.card, styles.linkCard]}>
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

        <Text style={styles.versionText}>Toma Asistencia UMB · v1.0.0</Text>
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

      <Modal
        visible={showEdit}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!profileIncomplete) setShowEdit(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '86%' }]}>
            <ScrollView>
              <Text style={styles.modalTitle}>Completa tu perfil</Text>
              <Text style={styles.modalText}>
                {profileIncomplete
                  ? studentProfileIncompleteMessage(profileSnapshot)
                  : 'Puedes actualizar nombre, carrera, semestre y teléfono. El correo y el código estudiantil no se modifican.'}
              </Text>
              <View style={{ height: 14 }} />
              <Input label="Nombre completo *" value={draftName} onChangeText={setDraftName} />
              <View style={{ height: 12 }} />
              <Input label="Carrera / Programa *" value={draftProgram} onChangeText={setDraftProgram} />
              <View style={{ height: 12 }} />
              <Input
                label="Semestre *"
                value={draftSemester}
                onChangeText={setDraftSemester}
                keyboardType="number-pad"
              />
              <View style={{ height: 12 }} />
              <Input
                label="Teléfono *"
                value={draftPhone}
                onChangeText={setDraftPhone}
                keyboardType="phone-pad"
              />
              <View style={{ height: 14 }} />
              <Input label="Correo (solo lectura)" value={email || ''} editable={false} />
              <View style={{ height: 12 }} />
              <Input label="Código estudiantil (solo lectura)" value={studentCode || ''} editable={false} />
              <View style={{ height: 14 }} />
              {!profileIncomplete ? (
                <>
                  <Button fullWidth variant="outline" onPress={() => setShowEdit(false)}>
                    Cancelar
                  </Button>
                  <View style={{ height: 10 }} />
                </>
              ) : null}
              <Button fullWidth onPress={saveProfile} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showPrivacyMenu} transparent animationType="fade" onRequestClose={() => setShowPrivacyMenu(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Privacidad</Text>
            <Text style={styles.modalText}>Consulta los mismos documentos que aceptaste al registrarte.</Text>
            <View style={{ height: 16 }} />
            <Pressable
              onPress={() => { setShowPrivacyMenu(false); setLegalDoc('terms'); }}
              style={styles.privacyRow}
            >
              <FileText size={18} color="#1E40AF" />
              <Text style={styles.privacyRowText}>Términos y Condiciones</Text>
            </Pressable>
            <Pressable
              onPress={() => { setShowPrivacyMenu(false); setLegalDoc('privacy'); }}
              style={styles.privacyRow}
            >
              <Shield size={18} color="#059669" />
              <Text style={styles.privacyRowText}>Política de Privacidad</Text>
            </Pressable>
            <Pressable
              onPress={() => { setShowPrivacyMenu(false); setLegalDoc('biometric'); }}
              style={styles.privacyRow}
            >
              <Shield size={18} color="#7C3AED" />
              <Text style={styles.privacyRowText}>Autorización biométrica</Text>
            </Pressable>
            <View style={{ height: 12 }} />
            <Button fullWidth variant="outline" onPress={() => setShowPrivacyMenu(false)}>
              Cerrar
            </Button>
          </View>
        </View>
      </Modal>

      <TermsAndConditionsModal
        visible={legalDoc === 'terms'}
        readOnly
        onClose={() => setLegalDoc(null)}
        onAccept={() => setLegalDoc(null)}
      />
      <PrivacyPolicyModal
        visible={legalDoc === 'privacy'}
        readOnly
        onClose={() => setLegalDoc(null)}
        onAccept={() => setLegalDoc(null)}
      />
      <BiometricConsentModal
        visible={legalDoc === 'biometric'}
        readOnly
        onClose={() => setLegalDoc(null)}
        onAccept={() => setLegalDoc(null)}
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
  photoImg: { width: 96, height: 96, borderRadius: 48 },
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
  profileProgram: { marginTop: 4, color: '#6B7280', textAlign: 'center' },
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
  sectionTitle: { fontWeight: '900', color: '#1F2937', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 12, color: '#6B7280' },
  infoValue: { fontWeight: '800', color: '#1F2937', marginTop: 2 },
  linkCard: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  linkText: { fontWeight: '800', color: '#1F2937', flex: 1 },
  logoutCard: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  logoutText: { fontWeight: '900', color: '#DC2626' },
  versionText: { marginTop: 16, textAlign: 'center', color: '#9CA3AF', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 },
  modalIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 4 },
  modalTitle: { marginTop: 12, fontSize: 20, fontWeight: '900', textAlign: 'center', color: '#111827' },
  modalText: { marginTop: 6, textAlign: 'center', color: '#6B7280' },
  modalButtons: { marginTop: 8 },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  privacyRowText: { fontWeight: '700', color: '#111827' },
});
