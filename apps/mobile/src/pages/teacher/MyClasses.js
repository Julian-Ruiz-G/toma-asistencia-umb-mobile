import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, BookOpen, RefreshCw } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { MY_CLASSES_URL } from '../../config';
import { useAuth } from '../../state/auth';

export default function MyClasses({ navigation }) {
  const { authToken } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!MY_CLASSES_URL) {
      Alert.alert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }
    if (!authToken) {
      Alert.alert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(MY_CLASSES_URL, {
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
      setClasses(Array.isArray(json?.classes) ? json.classes : []);
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mis clases</Text>
          <Text style={styles.headerSubtitle}>Listado de tus cursos</Text>
        </View>
        <Pressable onPress={load} style={styles.iconBtn}>
          <RefreshCw size={20} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.topActions}>
          <Button variant="outline" fullWidth isLoading={loading} onPress={load}>
            Refrescar
          </Button>
        </View>

        <View style={{ height: 14 }} />

        {classes.map((c, idx) => (
          <Pressable
            key={String(c?.classId || idx)}
            onPress={() => navigation.navigate('TeacherClassDetails', { classId: c.classId })}
            style={styles.classCard}
          >
            <View style={styles.classRow}>
              <View style={styles.classIcon}>
                <BookOpen size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.className}>{c?.className || 'Clase'}</Text>
                <Text style={styles.classMeta}>Grupo: {c?.group || ''}</Text>
              </View>
            </View>
          </Pressable>
        ))}

        {classes.length === 0 && !loading ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No hay clases</Text>
            <Text style={styles.emptyText}>Crea una clase o refresca para volver a intentar.</Text>
            <View style={{ height: 12 }} />
            <Button fullWidth onPress={() => navigation.navigate('TeacherCreateClass')}>
              Crear clase
            </Button>
          </View>
        ) : null}

        <View style={{ height: 18 }} />
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
  iconBtn: { padding: 10, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: '#6B7280' },
  body: { paddingHorizontal: 24, paddingVertical: 18, paddingBottom: 30 },
  topActions: {},
  classCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    marginBottom: 12,
  },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  classIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(185,28,28,0.10)', alignItems: 'center', justifyContent: 'center' },
  className: { fontWeight: '900', color: '#111827' },
  classMeta: { marginTop: 2, color: '#6B7280' },
  emptyWrap: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
  },
  emptyTitle: { fontWeight: '900', color: '#111827', fontSize: 16 },
  emptyText: { marginTop: 6, color: '#6B7280', textAlign: 'center' },
});
