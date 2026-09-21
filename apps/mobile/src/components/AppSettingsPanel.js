import React, { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Bell, Info, Monitor, Moon, Smartphone, Sun } from 'lucide-react-native';
import Constants from 'expo-constants';

import { useAppTheme, useColors } from '../ui/ThemeContext';
import { useAuth } from '../state/auth';
import { cancelReminderNotification, scheduleReminderNotification } from '../utils/localNotify';
import { loadReminders, reminderOccurrences, saveReminders } from '../utils/remindersStore';
import { appAlert } from '../ui/appNotice';
import OverlayDismiss from './OverlayDismiss';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

function AppearanceCard() {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { themePref, setTheme } = useAppTheme();

  const options = [
    { id: 'light', label: 'Claro', Icon: Sun },
    { id: 'dark', label: 'Oscuro', Icon: Moon },
    { id: 'system', label: 'Sistema', Icon: Monitor },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Tema de la aplicación</Text>
      <View style={styles.themeRow}>
        {options.map((opt) => {
          const active = themePref === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setTheme(opt.id)}
              style={[styles.themeChip, active ? styles.themeChipActive : null]}
            >
              <opt.Icon size={18} color={active ? COLORS.white : COLORS.icon} />
              <Text style={[styles.themeChipText, active ? styles.themeChipTextActive : null]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function NotificationsCard() {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { email } = useAuth();
  const {
    inAppNotifications,
    setInAppNotifications,
    deviceNotifications,
    setDeviceNotifications,
  } = useAppTheme();

  const onDeviceChange = async (next) => {
    const result = await setDeviceNotifications(next);
    if (next && result && !result.ok && result.reason === 'permission') {
      appAlert(
        'Permiso de notificaciones',
        'El celular bloqueó los avisos. Puedes activarlos en Ajustes del sistema.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    if (next && result?.ok && email) {
      try {
        const list = await loadReminders(email);
        const updated = [];
        for (const item of list) {
          await cancelReminderNotification(item.notificationIds || item.notificationId);
          const ids = [];
          for (const occ of reminderOccurrences(item)) {
            const nid = await scheduleReminderNotification({
              id: item.id,
              title: item.title,
              description: item.description,
              when: occ.when,
            });
            if (nid) ids.push(nid);
          }
          updated.push({ ...item, notificationIds: ids, notificationId: ids[0] || null });
        }
        await saveReminders(email, updated);
      } catch {
        // ignore
      }
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Notificaciones</Text>

      <View style={styles.switchRow}>
        <View style={[styles.infoIcon, { backgroundColor: COLORS.primarySoft }]}>
          <Bell size={18} color={COLORS.primary} />
        </View>
        <View style={styles.switchCopy}>
          <Text style={styles.switchTitle}>En la aplicación</Text>
          <Text style={styles.switchHint}>Avisos dentro de la app</Text>
        </View>
        <Switch
          value={inAppNotifications}
          onValueChange={setInAppNotifications}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
          thumbColor={inAppNotifications ? COLORS.white : COLORS.placeholder}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.switchRow}>
        <View style={[styles.infoIcon, { backgroundColor: COLORS.surface }]}>
          <Smartphone size={18} color={COLORS.icon} />
        </View>
        <View style={styles.switchCopy}>
          <Text style={styles.switchTitle}>En el celular</Text>
          <Text style={styles.switchHint}>Avisos en la barra del teléfono</Text>
        </View>
        <Switch
          value={deviceNotifications}
          onValueChange={onDeviceChange}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
          thumbColor={deviceNotifications ? COLORS.white : COLORS.placeholder}
        />
      </View>
    </View>
  );
}

export function AboutRow({ onPress }) {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <Pressable onPress={onPress} style={[styles.card, styles.linkCard]}>
      <View style={styles.linkLeft}>
        <View style={[styles.infoIcon, { backgroundColor: COLORS.surface }]}>
          <Info size={20} color={COLORS.icon} />
        </View>
        <Text style={styles.linkText}>Acerca de</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function AboutModal({ visible, onClose }) {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <OverlayDismiss style={styles.modalOverlay} onClose={onClose}>
        <View style={styles.modalCard}>
          <Text style={styles.modalKicker}>UMB</Text>
          <Text style={styles.modalTitle}>Toma Asistencia UMB</Text>
          <Text style={styles.modalVersion}>Versión {APP_VERSION}</Text>
          <Text style={styles.modalText}>
            Sistema de control de asistencia de la Universidad Manuela Beltrán. Registro por código QR y reconocimiento facial, con historial, reportes y avisos para estudiantes, docentes y administración.
          </Text>
          <Text style={styles.modalMeta}>Uso interno institucional · Proyecto de grado</Text>
          <Pressable onPress={onClose} style={styles.modalBtn}>
            <Text style={styles.modalBtnText}>Cerrar</Text>
          </Pressable>
        </View>
      </OverlayDismiss>
    </Modal>
  );
}

export function AppSettingsBlocks() {
  return (
    <>
      <AppearanceCard />
      <View style={{ height: 14 }} />
      <NotificationsCard />
    </>
  );
}

export function AppAboutBlock() {
  const [showAbout, setShowAbout] = useState(false);
  return (
    <>
      <AboutRow onPress={() => setShowAbout(true)} />
      <AboutModal visible={showAbout} onClose={() => setShowAbout(false)} />
    </>
  );
}

function makeStyles(COLORS) {
  return StyleSheet.create({
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: COLORS.black,
      shadowOpacity: COLORS.scheme === 'dark' ? 0.35 : 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    sectionTitle: { fontWeight: '900', color: COLORS.text, fontSize: 16, marginBottom: 14 },
    sectionHint: { marginTop: 4, marginBottom: 14, color: COLORS.muted, fontSize: 13, lineHeight: 18 },
    themeRow: { flexDirection: 'row', gap: 8 },
    themeChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    themeChipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    themeChipText: { fontWeight: '800', fontSize: 12, color: COLORS.textSecondary },
    themeChipTextActive: { color: COLORS.white },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    switchCopy: { flex: 1 },
    switchTitle: { fontWeight: '800', color: COLORS.text },
    switchHint: { marginTop: 2, fontSize: 12, color: COLORS.muted, lineHeight: 16 },
    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
    infoIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkCard: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    linkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    linkText: { fontWeight: '800', color: COLORS.text, flex: 1 },
    chevron: { fontSize: 22, color: COLORS.placeholder, fontWeight: '600' },
    modalOverlay: {
      flex: 1,
      backgroundColor: COLORS.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: COLORS.card,
      borderRadius: 18,
      padding: 20,
      width: '100%',
      maxWidth: 360,
    },
    modalKicker: {
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '800',
      color: COLORS.primary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    modalTitle: { marginTop: 8, fontSize: 20, fontWeight: '900', textAlign: 'center', color: COLORS.text },
    modalVersion: { marginTop: 4, textAlign: 'center', color: COLORS.muted, fontWeight: '700' },
    modalText: { marginTop: 12, textAlign: 'center', color: COLORS.textSecondary, lineHeight: 20, fontSize: 14 },
    modalMeta: { marginTop: 12, textAlign: 'center', color: COLORS.placeholder, fontSize: 12 },
    modalBtn: {
      marginTop: 18,
      backgroundColor: COLORS.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
    },
    modalBtnText: { color: COLORS.white, fontWeight: '900' },
  });
}
