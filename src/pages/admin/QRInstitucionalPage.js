import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Check, Copy, Download, QrCode, Share2, Users } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';

export default function QRInstitucionalPage({ navigation }) {
  const [activeTab, setActiveTab] = useState('general');
  const [copied, setCopied] = useState(false);
  const [eventName, setEventName] = useState('');
  const [expiryHours, setExpiryHours] = useState(24);

  const tabs = useMemo(() => ['general', 'eventos', 'personalizado'], []);

  const handleCopyLink = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#4B5563" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>QR Institucional</Text>
          <Text style={styles.headerSubtitle}>Genera códigos QR</Text>
        </View>
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
          {activeTab === 'general' ? (
            <View>
              <Text style={styles.sectionTitle}>QR General</Text>
              <View style={styles.qrPreview}>
                <QrCode size={64} color="#9CA3AF" />
              </View>
              <View style={styles.btnRow}>
                <Button fullWidth onPress={() => {}}>
                  Descargar
                </Button>
                <View style={{ height: 10 }} />
                <Button fullWidth variant="outline" onPress={() => {}}>
                  Compartir
                </Button>
              </View>
            </View>
          ) : null}

          {activeTab === 'eventos' ? (
            <View>
              <Text style={styles.sectionTitle}>QR para Evento</Text>
              <Text style={styles.label}>Nombre del evento</Text>
              <TextInput
                value={eventName}
                onChangeText={setEventName}
                placeholder="Ej: Ceremonia de Graduación"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
              <Text style={[styles.label, { marginTop: 12 }]}>Vigencia: {expiryHours}h</Text>
              <View style={styles.qrPreviewSmall}>
                <QrCode size={52} color="#9CA3AF" />
              </View>
              <View style={{ height: 12 }} />
              <Button fullWidth onPress={() => {}}>Generar QR</Button>
            </View>
          ) : null}

          {activeTab === 'personalizado' ? (
            <View>
              <Text style={styles.sectionTitle}>QR Personalizado</Text>
              <Text style={styles.label}>URL destino</Text>
              <TextInput placeholder="https://..." placeholderTextColor="#9CA3AF" style={styles.input} />
              <View style={{ height: 12 }} />
              <Button fullWidth onPress={() => {}}>Generar QR</Button>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { marginTop: 12 }]}
>
          <Text style={styles.sectionTitle}>Estadísticas</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statMini, { backgroundColor: '#EFF6FF' }]}>
              <View style={styles.statMiniRow}>
                <Users size={14} color="#2563EB" />
                <Text style={styles.statMiniLabel}>Escaneos</Text>
              </View>
              <Text style={styles.statMiniValue}>1,234</Text>
            </View>
            <View style={[styles.statMini, { backgroundColor: '#ECFDF5' }]}>
              <View style={styles.statMiniRow}>
                <Check size={14} color="#16A34A" />
                <Text style={styles.statMiniLabel}>Registros</Text>
              </View>
              <Text style={styles.statMiniValue}>1,198</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { marginTop: 12 }]}
>
          <Text style={styles.sectionTitle}>Enlace directo</Text>
          <View style={styles.linkRow}>
            <View style={styles.linkBox}>
              <Text numberOfLines={1} style={styles.linkText}>https://asistencia.umb.edu.co/qr/institucional-2024</Text>
            </View>
            <Pressable onPress={handleCopyLink} style={styles.copyBtn}>
              {copied ? <Check size={18} color="#16A34A" /> : <Copy size={18} color="#4B5563" />}
            </Pressable>
          </View>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#F3F4F6' },
  headerTitle: { fontWeight: '900', color: '#111827', fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  body: { padding: 16, paddingBottom: 26 },
  tabsCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 6 },
  tabsRow: { flexDirection: 'row', gap: 6 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabText: { fontWeight: '900', color: '#6B7280', textTransform: 'capitalize' },
  tabTextActive: { color: '#fff' },
  card: { marginTop: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 14 },
  sectionTitle: { fontWeight: '900', color: '#111827' },
  qrPreview: { marginTop: 14, height: 180, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: '#D1D5DB' },
  qrPreviewSmall: { marginTop: 12, height: 140, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: '#D1D5DB' },
  btnRow: { marginTop: 14 },
  label: { marginTop: 10, marginBottom: 8, color: '#374151', fontWeight: '900' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', color: '#111827' },
  statsGrid: { marginTop: 12, flexDirection: 'row', gap: 12 },
  statMini: { flex: 1, borderRadius: 14, padding: 12 },
  statMiniRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statMiniLabel: { color: '#6B7280', fontSize: 12 },
  statMiniValue: { marginTop: 8, fontWeight: '900', color: '#111827', fontSize: 18 },
  linkRow: { marginTop: 10, flexDirection: 'row', gap: 10, alignItems: 'center' },
  linkBox: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  linkText: { color: '#374151', fontSize: 12 },
  copyBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
});
