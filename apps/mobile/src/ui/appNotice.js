import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

let showFn = null;

export function bindAppNotice(fn) {
  showFn = fn;
}

export function showAppNotice(notice) {
  if (typeof showFn !== 'function') return false;
  showFn(notice ? { ...notice } : null);
  return true;
}

function inferKind(title) {
  const t = String(title || '').toLowerCase();
  if (
    t.includes('error') ||
    t.includes('no se pudo') ||
    t.includes('inválid') ||
    t.includes('invalida') ||
    t.includes('denegad') ||
    t.includes('falló') ||
    t.includes('fallo')
  ) {
    return 'error';
  }
  if (
    t.includes('listo') ||
    t.includes('cread') ||
    t.includes('actualiz') ||
    t.includes('eliminad') ||
    t.includes('guardad') ||
    t.includes('finaliz') ||
    t.includes('cuenta creada')
  ) {
    return 'success';
  }
  if (
    t.includes('permiso') ||
    t.includes('falta') ||
    t.includes('elige') ||
    t.includes('pendiente') ||
    t.includes('incompleto') ||
    t.includes('obligator') ||
    t.includes('sin ')
  ) {
    return 'warning';
  }
  if (t.includes('eliminar') || t.includes('confirmar')) return 'confirm';
  return 'info';
}

function kickerFor(kind, explicit) {
  if (explicit) return explicit;
  if (kind === 'error') return 'Error';
  if (kind === 'success') return 'Listo';
  if (kind === 'warning') return 'Aviso';
  if (kind === 'confirm') return 'Confirmar';
  if (kind === 'offday' || kind === 'early' || kind === 'late') return 'Aviso de horario';
  return 'Aviso';
}

function splitBody(message) {
  const raw = String(message || '').trim();
  if (!raw) return { subtitle: '', points: [] };
  const parts = raw
    .split(/\n+/)
    .map((s) => s.replace(/^[•\-\u2022]\s*/, '').trim())
    .filter(Boolean);
  if (parts.length <= 1) return { subtitle: raw, points: [] };
  return { subtitle: parts[0], points: parts.slice(1) };
}

/**
 * Drop-in de Alert.alert(title, message?, buttons?).
 * Mantiene onPress / style: 'cancel' | 'destructive'.
 */
export function appAlert(title, message, buttons) {
  const list = Array.isArray(buttons) ? buttons.filter(Boolean) : [];
  const cancel = list.find((b) => b.style === 'cancel');
  const destructive = list.find((b) => b.style === 'destructive');
  const rest = list.filter((b) => b !== cancel);
  const primary = destructive || rest[rest.length - 1] || { text: 'Entendido' };
  const secondary = cancel || (rest.length > 1 && rest[0] !== primary ? rest[0] : null);

  const kind = destructive || (cancel && rest.length) ? 'confirm' : inferKind(title);
  if (!isInAppNotificationsEnabled() && kind !== 'error' && kind !== 'confirm') {
    return false;
  }
  const body = splitBody(message);
  const shown = showAppNotice({
    kind,
    kicker: kickerFor(kind),
    title: String(title || 'Aviso'),
    subtitle: body.subtitle,
    points: body.points,
    primaryLabel: primary.text || 'Entendido',
    secondaryLabel: secondary?.text,
    destructive: primary.style === 'destructive' || kind === 'error',
    onPrimary: primary.onPress,
    onSecondary: secondary?.onPress,
  });
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

export function AppNoticeHost() {
  const COLORS = useColors();
  const styles = makeNoticeStyles(COLORS);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    bindAppNotice(setNotice);
    return () => bindAppNotice(null);
  }, []);

  const close = (which) => {
    const n = notice;
    setNotice(null);
    const fn = which === 'primary' ? n?.onPrimary : which === 'secondary' ? n?.onSecondary : null;
    if (typeof fn === 'function') setTimeout(fn, 40);
  };

  const Icon = ICONS[notice?.kind] || Info;
  const primaryLabel = notice?.primaryLabel || 'Entendido';
  const secondaryLabel = notice?.secondaryLabel;
  const points = notice?.points || [];

  return (
    <Modal
      visible={!!notice}
      transparent
      animationType="fade"
      onRequestClose={() => close(secondaryLabel ? 'secondary' : 'primary')}
    >
      <OverlayDismiss
        style={styles.backdrop}
        onClose={() => close(secondaryLabel ? 'secondary' : 'primary')}
      >
        <View style={styles.card}>
          <Text style={styles.kicker}>{kickerFor(notice?.kind, notice?.kicker)}</Text>
          <View style={styles.iconWrap}>
            <Icon size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{notice?.title}</Text>
          {notice?.subtitle ? <Text style={styles.subtitle}>{notice.subtitle}</Text> : null}
          {points.length ? (
            <ScrollView style={styles.pointsScroll} contentContainerStyle={styles.points} nestedScrollEnabled>
              {points.map((p) => (
                <View key={p} style={styles.pointRow}>
                  <View style={styles.dot} />
                  <Text style={styles.point}>{p}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
          <Pressable onPress={() => close('primary')} style={styles.btn}>
            <Text style={styles.btnText}>{primaryLabel}</Text>
          </Pressable>
          {secondaryLabel ? (
            <Pressable onPress={() => close('secondary')} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>{secondaryLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </OverlayDismiss>
    </Modal>
  );
}

function makeNoticeStyles(COLORS) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: COLORS.overlay,
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
