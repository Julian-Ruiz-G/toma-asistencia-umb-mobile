import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
} from 'lucide-react-native';
import { isInAppNotificationsEnabled } from '../utils/appSettings';
import OverlayDismiss from '../components/OverlayDismiss';
import { useColors } from './ThemeContext';
import { prepareAppAlert, presentNotice } from './appNoticeModel.cjs';

let showFn = null;

export function bindAppNotice(fn) {
  showFn = fn;
}

export function showAppNotice(notice) {
  if (typeof showFn !== 'function') return false;
  showFn(notice ? { ...notice } : null);
  return true;
}

/**
 * Drop-in de Alert.alert(title, message?, buttons?).
 * Mantiene onPress / style: 'cancel' | 'destructive'.
 */
export function appAlert(title, message, buttons) {
  const notice = prepareAppAlert(title, message, buttons, {
    notificationsEnabled: isInAppNotificationsEnabled(),
  });
  if (!notice) return false;
  const shown = showAppNotice(notice);
  if (!shown && typeof console !== 'undefined') {
    console.warn('[appAlert]', title, message);
  }
  return shown;
}

const ICONS = {
  offday: CalendarOff,
  early: Clock,
  late: Clock,
  error: AlertTriangle,
  warning: ShieldAlert,
  success: CheckCircle2,
  confirm: AlertTriangle,
  info: Info,
};

export function AppNoticeHost({ blurTarget }) {
  const COLORS = useColors();
  const styles = makeNoticeStyles(COLORS);
  const [notice, setNotice] = useState(null);
  const noticeRef = useRef(null);
  noticeRef.current = notice;
  bindAppNotice(setNotice);
  useEffect(() => {
    bindAppNotice(setNotice);
    return () => bindAppNotice(null);
  }, []);

  const close = (which) => {
    const n = noticeRef.current;
    setNotice(null);
    const fn = which === 'primary' ? n?.onPrimary : which === 'secondary' ? n?.onSecondary : null;
    if (typeof fn === 'function') setTimeout(fn, 40);
  };

  const shown = notice ? presentNotice(notice) : null;
  const Icon = ICONS[shown?.kind] || Info;
  const dismissWhich = shown?.secondaryLabel ? 'secondary' : 'primary';

  return (
    <Modal
      visible={!!shown}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close(dismissWhich)}
    >
      {shown ? (
      <View style={styles.layer}>
        <BlurView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          intensity={80}
          tint="dark"
          blurMethod="dimezisBlurView"
          blurReductionFactor={2}
          blurTarget={blurTarget}
        />
        <View pointerEvents="none" style={styles.veil} />
        <OverlayDismiss style={styles.backdrop} onClose={() => close(dismissWhich)}>
          <View style={styles.card}>
            <Text style={styles.kicker}>{shown.kicker}</Text>
            <View style={styles.iconWrap}>
              <Icon size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>{shown.title}</Text>
            {shown.subtitle ? <Text style={styles.subtitle}>{shown.subtitle}</Text> : null}
            {shown.points.length ? (
              <ScrollView style={styles.pointsScroll} contentContainerStyle={styles.points} nestedScrollEnabled>
                {shown.points.map((p) => (
                  <View key={p} style={styles.pointRow}>
                    <View style={styles.dot} />
                    <Text style={styles.point}>{p}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <Pressable
              onPress={() => close('primary')}
              style={[styles.btn, shown.destructive ? styles.btnDanger : null]}
            >
              <Text style={styles.btnText}>{shown.primaryLabel}</Text>
            </Pressable>
            {shown.secondaryLabel ? (
              <Pressable onPress={() => close('secondary')} style={styles.btnGhost}>
                <Text style={styles.btnGhostText}>{shown.secondaryLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </OverlayDismiss>
      </View>
      ) : null}
    </Modal>
  );
}

function makeNoticeStyles(COLORS) {
  return StyleSheet.create({
    layer: { flex: 1 },
    veil: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(15, 23, 42, 0.34)',
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    card: {
      width: '100%',
      maxWidth: 360,
      alignSelf: 'stretch',
      backgroundColor: COLORS.card,
      borderRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 20,
      paddingBottom: 18,
      maxHeight: '88%',
    },
    kicker: {
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '900',
      color: COLORS.primary,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: COLORS.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 12,
    },
    title: { fontSize: 20, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
    subtitle: { marginTop: 8, fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },
    pointsScroll: { marginTop: 12, maxHeight: 220 },
    points: { gap: 10, paddingBottom: 4 },
    pointRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6 },
    point: { flex: 1, color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, fontWeight: '600' },
    btn: {
      marginTop: 18,
      backgroundColor: COLORS.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    btnDanger: { backgroundColor: COLORS.dangerStrong },
    btnText: { color: COLORS.white, fontWeight: '900', fontSize: 15 },
    btnGhost: {
      marginTop: 8,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
    },
    btnGhostText: { color: COLORS.icon, fontWeight: '800', fontSize: 15 },
  });
}
