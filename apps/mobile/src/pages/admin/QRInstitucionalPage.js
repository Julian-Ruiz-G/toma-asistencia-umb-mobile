import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, QrCode } from 'lucide-react-native';
import ScannableQR from '../../components/ScannableQR';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import { appAlert } from '../../ui/appNotice';
import { AdminNavButtons, useAdminDrawer } from '../../components/AdminDrawer';
import { MenuButton } from '../../components/RoleDrawer';
import { headerTop } from '../../ui/safeArea';

const GENERAL_PAYLOAD = 'UMB-ASISTENCIA|institucional';

export default function QRInstitucionalPage({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useAdminDrawer(navigation, 'AdminQrInstitutional');
  const [activeTab, setActiveTab] = useState('general');
  const [copied, setCopied] = useState(false);
  const [eventName, setEventName] = useState('');
  const [expiryHours, setExpiryHours] = useState('24');
  const [customUrl, setCustomUrl] = useState('');
  const [eventPayload, setEventPayload] = useState('');
  const [customPayload, setCustomPayload] = useState('');

  const tabs = useMemo(() => ['general', 'eventos', 'personalizado'], []);
  const payload = activeTab === 'eventos'
    ? eventPayload
    : activeTab === 'personalizado'
      ? customPayload
      : GENERAL_PAYLOAD;

  const sharePayload = async () => {
    if (!payload) {
      appAlert('Sin código', 'Genera el QR antes de compartirlo.');
      return;
    }
    try {
      await Share.share({ message: payload });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      appAlert('No se pudo compartir', 'Intenta de nuevo.');
    }
  };

  const generateEvent = () => {
    const name = eventName.trim();
    const hours = Math.max(1, Number(expiryHours) || 24);
    if (!name) {
      appAlert('Falta el nombre', 'Escribe el nombre del evento.');
      return;
    }
    const exp = Date.now() + hours * 60 * 60 * 1000;
    setEventPayload(`UMB-ASISTENCIA|evento|${name}|${exp}`);
  };

  const generateCustom = () => {
    const url = customUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      appAlert('URL inválida', 'El enlace debe empezar por http:// o https://.');
      return;
    }
    setCustomPayload(url);
  };

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <AdminNavButtons onBack={goBack} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>QR Institucional</Text>
          <Text style={styles.headerSubtitle}>Genera códigos QR</Text>
        </View>
        <MenuButton onPress={openDrawer} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.tabsCard}>
          <View style={styles.tabsRow}>
            {tabs.map((t) => {
              const active = activeTab === t;
              return (
                <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, active ? styles.tabBtnActive : null]}>
                  <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          {payload ? (
            <View style={styles.qrPreview}>
              <ScannableQR value={payload} size={168} />
            </View>
          ) : (
            <View style={styles.qrPreview}>
              <QrCode size={64} color={COLORS.placeholder} />
              <Text style={styles.emptyQr}>Genera el código para verlo aquí</Text>
            </View>
          )}

          {activeTab === 'general' ? (
            <Text style={styles.sectionTitle}>QR general de la universidad</Text>
          ) : null}

          {activeTab === 'eventos' ? (
            <View>
              <Text style={styles.sectionTitle}>QR para evento</Text>
              <Text style={styles.label}>Nombre del evento</Text>
              <TextInput
                value={eventName}
                onChangeText={setEventName}
                placeholder="Ej: Ceremonia de graduación"
                placeholderTextColor={COLORS.placeholder}
                style={styles.input}
              />
              <Text style={styles.label}>Horas de vigencia</Text>
              <TextInput
                value={expiryHours}
                onChangeText={setExpiryHours}
                keyboardType="number-pad"
                placeholder="24"
                placeholderTextColor={COLORS.placeholder}
                style={styles.input}
              />
              <View style={{ height: 12 }} />
              <Button fullWidth onPress={generateEvent}>Generar QR</Button>
            </View>
          ) : null}

          {activeTab === 'personalizado' ? (
            <View>
              <Text style={styles.sectionTitle}>QR personalizado</Text>
              <Text style={styles.label}>URL destino</Text>
              <TextInput
                value={customUrl}
                onChangeText={setCustomUrl}
                placeholder="https://..."
                placeholderTextColor={COLORS.placeholder}
                autoCapitalize="none"
                style={styles.input}
              />
              <View style={{ height: 12 }} />
              <Button fullWidth onPress={generateCustom}>Generar QR</Button>
            </View>
          ) : null}

          <View style={{ height: 12 }} />
          <Button fullWidth variant="outline" onPress={sharePayload}>Compartir</Button>
        </View>

        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>Contenido del código</Text>
          <View style={styles.linkRow}>
            <View style={styles.linkBox}>
              <Text style={styles.linkText}>{payload || 'Aún no hay un código'}</Text>
            </View>
            <Pressable onPress={sharePayload} style={styles.copyBtn}>
              {copied ? <Check size={18} color={COLORS.successStrong} /> : <QrCode size={18} color={COLORS.icon} />}
            </Pressable>
          </View>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.card, paddingTop: headerTop(12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.surface },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  body: { padding: 16, paddingBottom: 26 },
  tabsCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 6 },
  tabsRow: { flexDirection: 'row', gap: 6 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabText: { fontWeight: '900', color: COLORS.muted, textTransform: 'capitalize' },
  tabTextActive: { color: COLORS.white },
  card: { marginTop: 12, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  sectionTitle: { fontWeight: '900', color: COLORS.text },
  qrPreview: { marginTop: 14, marginBottom: 14, minHeight: 200, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  emptyQr: { marginTop: 8, color: COLORS.muted, fontWeight: '700', textAlign: 'center' },
  qrPreviewSmall: { marginTop: 12, height: 140, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.border },
  btnRow: { marginTop: 14 },
  label: { marginTop: 10, marginBottom: 8, color: COLORS.textSecondary, fontWeight: '900' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.card, color: COLORS.text },
  statsGrid: { marginTop: 12, flexDirection: 'row', gap: 12 },
  statMini: { flex: 1, borderRadius: 14, padding: 12 },
  statMiniRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statMiniLabel: { color: COLORS.muted, fontSize: 12 },
  statMiniValue: { marginTop: 8, fontWeight: '900', color: COLORS.text, fontSize: 18 },
  linkRow: { marginTop: 10, flexDirection: 'row', gap: 10, alignItems: 'center' },
  linkBox: { flex: 1, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  linkText: { color: COLORS.textSecondary, fontSize: 12 },
  copyBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
});
