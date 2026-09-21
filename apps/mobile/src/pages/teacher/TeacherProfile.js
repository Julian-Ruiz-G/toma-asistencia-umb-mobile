import React, { useEffect, useState, useMemo } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  ChevronRight,
  Hash,
  LogOut,
  Mail,
  Shield,
  User,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import OverlayDismiss from '../../components/OverlayDismiss';
import TermsAndConditionsModal from '../../components/TermsAndConditions';
import PrivacyPolicyModal from '../../components/PrivacyPolicy';
import { AppSettingsBlocks, AppAboutBlock } from '../../components/AppSettingsPanel';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import Animated, { enterDown } from '../../ui/motion';
import { useAuth } from '../../state/auth';
import { personDisplayName } from '../../utils/displayName';
import { SET_CONSENT_URL } from '../../config';
import {
  copyLocalAvatar,
  loadLocalProfile,
  saveLocalProfile,
} from '../../utils/sessionStore';

export default function TeacherProfile({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { email, logout, teacherCode, fullName, photoUri, setPhotoUri, authToken } = useAuth();
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null);
  const requestedOpen = String(route?.params?.open || '');
  const fromAdminRequest = ['edit', 'terms', 'privacy'].includes(requestedOpen);

  useEffect(() => {
    (async () => {
      const local = await loadLocalProfile(email);
      if (local?.photoUri) setPhotoUri(String(local.photoUri));
    })();
  }, [email, setPhotoUri]);

  useEffect(() => {
    if (requestedOpen === 'privacy' || requestedOpen === 'terms') {
      setLegalDoc(requestedOpen);
    }
  }, [requestedOpen]);

  const displayName = personDisplayName(fullName, 'Docente');

  const saveConsent = async (fields) => {
    try {
      if (!SET_CONSENT_URL || !authToken) return;
      await fetch(SET_CONSENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(fields),
      });
    } catch {
      // ignore
    }
  };

  const pickLocalPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        appAlert('Permiso requerido', 'Autoriza el acceso a la galería para elegir una foto.');
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
      setPhotoUri(finalUri);
      await saveLocalProfile(email, { photoUri: finalUri });
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    }
  };

  const handleLogout = () => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={enterDown(0, 360)} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          <Text style={styles.headerSubtitle}>Información del docente</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body}>
        <Animated.View entering={enterDown(80)}>
          <Card style={[styles.card, { padding: 20 }]}>
            <View style={{ alignItems: 'center' }}>
              <View style={styles.photoWrap}>
                <View style={styles.photoGradient}>
                  {photoUri ? (
                    <Image key={photoUri} source={{ uri: photoUri }} style={styles.photoImg} />
                  ) : (
                    <User size={44} color={COLORS.white} />
                  )}
                </View>
                <Pressable onPress={pickLocalPhoto} style={styles.cameraBtn}>
                  <Camera size={16} color={COLORS.white} />
                </Pressable>
              </View>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileProgram}>{email || '—'}</Text>
              <View style={styles.activePill}>
                <CheckCircle size={16} color={COLORS.successStrong} />
                <Text style={styles.activeText}>Docente activo</Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        <View style={{ height: 14 }} />

        <Animated.View entering={enterDown(160)}>
          <Card style={[styles.card, { padding: 18 }]}>
            <Text style={styles.sectionTitle}>Información personal</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}><Hash size={20} color={COLORS.icon} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Código docente</Text>
                <Text style={styles.infoValue}>{teacherCode || '—'}</Text>
              </View>
            </View>
            <View style={{ height: 14 }} />
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}><Mail size={20} color={COLORS.icon} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Correo institucional</Text>
                <Text style={styles.infoValue}>{email || '—'}</Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        <View style={{ height: 14 }} />

        <AppSettingsBlocks />

        <View style={{ height: 14 }} />

        <Pressable onPress={() => setShowPrivacyMenu(true)} style={[styles.card, styles.linkCard]}>
          <View style={styles.linkLeft}>
            <View style={[styles.infoIcon, { backgroundColor: COLORS.primarySoft }]}>
              <Shield size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.linkText}>Configuración de Privacidad</Text>
          </View>
          <ChevronRight size={20} color={COLORS.placeholder} />
        </Pressable>

        <View style={{ height: 14 }} />

        <AppAboutBlock />

        <View style={{ height: 14 }} />

        <Pressable
          onPress={() => appAlert(
            'Cerrar sesión',
            '¿Seguro que quieres salir de tu cuenta en este dispositivo?',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sí, cerrar', style: 'destructive', onPress: handleLogout },
            ]
          )}
          style={[styles.card, styles.logoutCard]}
        >
          <LogOut size={20} color={COLORS.dangerStrong} />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </Pressable>
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={showPrivacyMenu} transparent animationType="fade" onRequestClose={() => setShowPrivacyMenu(false)}>
        <OverlayDismiss style={styles.modalOverlay} onClose={() => setShowPrivacyMenu(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Privacidad</Text>
            <Button fullWidth variant="outline" onPress={() => { setShowPrivacyMenu(false); setLegalDoc('terms'); }}>Términos y condiciones</Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="outline" onPress={() => { setShowPrivacyMenu(false); setLegalDoc('privacy'); }}>Política de privacidad</Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="ghost" onPress={() => setShowPrivacyMenu(false)}>Cerrar</Button>
          </View>
        </OverlayDismiss>
      </Modal>

      <TermsAndConditionsModal
        visible={legalDoc === 'terms'}
        readOnly={!fromAdminRequest}
        onClose={() => setLegalDoc(null)}
        onAccept={() => { saveConsent({ acceptTerms: true }); setLegalDoc(null); }}
      />
      <PrivacyPolicyModal
        visible={legalDoc === 'privacy'}
        readOnly={!fromAdminRequest}
        onClose={() => setLegalDoc(null)}
        onAccept={() => { saveConsent({ acceptPrivacy: true }); setLegalDoc(null); }}
      />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.card, paddingHorizontal: 24, paddingBottom: 16, paddingTop: 48,
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 12, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: COLORS.muted },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  card: { backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border },
  photoWrap: { width: 96, height: 96 },
  photoGradient: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  photoImg: { width: 96, height: 96 },
  cameraBtn: {
    position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.text, alignItems: 'center', justifyContent: 'center',
  },
  profileName: { marginTop: 12, fontWeight: '900', fontSize: 20, color: COLORS.text },
  profileProgram: { marginTop: 4, color: COLORS.muted },
  activePill: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.successSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  activeText: { color: COLORS.successStrong, fontWeight: '800', fontSize: 12 },
  sectionTitle: { fontWeight: '900', color: COLORS.text, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { color: COLORS.muted, fontSize: 12 },
  infoValue: { marginTop: 2, fontWeight: '800', color: COLORS.text },
  linkCard: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  linkText: { fontWeight: '800', color: COLORS.text },
  logoutCard: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { fontWeight: '800', color: COLORS.dangerStrong },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 20 },
  modalTitle: { fontWeight: '900', fontSize: 18, color: COLORS.text, textAlign: 'center' },
  modalText: { marginTop: 8, color: COLORS.muted, textAlign: 'center' },
});
