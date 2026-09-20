import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, BookOpen, ChevronRight, Clock, Plus } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import Animated, { enterDown, listEnter } from '../../ui/motion';
import { MY_CLASSES_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { classStatusMeta, formatScheduleFriendly } from '../../utils/schedule';

export default function MyClasses({ navigation }) {
  const { authToken } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!MY_CLASSES_URL || !authToken) return;
    setLoading(true);
    try {
      const resp = await fetch(MY_CLASSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        throw new Error((json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`);
      }
      setClasses(Array.isArray(json?.classes) ? json.classes : []);
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.root}>
      <Animated.View entering={enterDown(0, 360)} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mis clases</Text>
          <Text style={styles.headerSubtitle}>{loading ? 'Actualizando…' : `${classes.length} curso${classes.length === 1 ? '' : 's'}`}</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body}>
        {classes.map((c, idx) => {
          const status = classStatusMeta(c);
          const schedule = formatScheduleFriendly(c);
          return (
            <Animated.View key={String(c?.classId || idx)} entering={listEnter(idx)}>
              <Pressable
                onPress={() => navigation.navigate('TeacherClassDetails', { classId: c.classId })}
                style={styles.classCard}
              >
                <View style={styles.classIcon}>
                  <BookOpen size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.className}>{c?.className || 'Clase'}</Text>
                  <Text style={styles.classMeta}>{c?.group ? `Grupo ${c.group}` : 'Sin grupo'}</Text>
                  <View style={styles.schedRow}>
                    <Clock size={12} color="#9CA3AF" />
                    <Text style={styles.schedText}>{schedule || 'Sin horario'}</Text>
                  </View>
                </View>
                <View style={styles.rightCol}>
                  <View style={[styles.pill, { backgroundColor: status.pillBg, borderColor: status.pillBorder }]}>
                    <Text style={[styles.pillText, { color: status.pillText }]}>{status.label}</Text>
                  </View>
                  <ChevronRight size={18} color="#9CA3AF" />
                </View>
              </Pressable>
            </Animated.View>
          );
        })}

        {classes.length === 0 && !loading ? (
          <View style={styles.emptyWrap}>
            <BookOpen size={36} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No hay clases</Text>
            <Text style={styles.emptyText}>Crea un curso para que los estudiantes puedan inscribirse.</Text>
            <View style={{ height: 14 }} />
            <Button fullWidth onPress={() => navigation.navigate('TeacherCreateClass')}>
              Crear clase
            </Button>
          </View>
        ) : (
          <Pressable onPress={() => navigation.navigate('TeacherCreateClass')} style={styles.addRow}>
            <Plus size={18} color={COLORS.primary} />
            <Text style={styles.addText}>Crear otra clase</Text>
          </Pressable>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
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
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  classCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  classIcon: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(185,28,28,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  className: { fontWeight: '900', color: '#111827' },
  classMeta: { marginTop: 2, color: '#6B7280', fontSize: 13 },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  schedText: { color: '#9CA3AF', fontSize: 12, flex: 1, fontWeight: '700' },
  rightCol: { alignItems: 'flex-end', gap: 10 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '900' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { marginTop: 12, fontWeight: '900', fontSize: 16, color: '#111827' },
  emptyText: { marginTop: 6, color: '#6B7280', textAlign: 'center', paddingHorizontal: 24 },
  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FECACA',
  },
  addText: { fontWeight: '800', color: COLORS.primary },
});
