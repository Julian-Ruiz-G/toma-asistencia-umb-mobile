import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Card, PrimaryButton, Screen } from '../ui/components';
import { MY_CLASSES_URL } from '../config';
import { useAuth } from '../state/auth';

export default function TeacherMyClasses({ navigation }) {
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
        body: JSON.stringify({})
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      setClasses(json?.classes || []);
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Screen title="Mis clases" onBack={() => navigation.goBack()}>
      <Card>
        <PrimaryButton title={loading ? 'Cargando...' : 'Refrescar'} onPress={load} />
        <View style={{ height: 12 }} />
        <FlatList
          data={classes}
          keyExtractor={(item, idx) => String(item?.classId || idx)}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('TeacherClassDetails', { classId: item.classId })}
              style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
            >
              <Text style={{ fontWeight: '800', color: '#111827' }}>{item?.className || 'Clase'}</Text>
              <Text style={{ marginTop: 3, color: '#6B7280' }}>Grupo: {item?.group || ''}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{ marginTop: 14, color: '#6B7280' }}>No hay clases.</Text>}
        />
      </Card>
    </Screen>
  );
}
