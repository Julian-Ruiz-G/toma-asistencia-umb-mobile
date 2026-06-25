import React from 'react';
import { View, Text } from 'react-native';
import { Card, PrimaryButton, Screen, SecondaryButton } from '../ui/components';
import { useAuth } from '../state/auth';

export default function StudentHome({ navigation }) {
  const { logout, email } = useAuth();
  return (
    <Screen title="Estudiante">
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800' }}>Inicio Estudiante</Text>
        <Text style={{ marginTop: 6, color: '#6B7280' }}>{email || ''}</Text>
        <View style={{ height: 16 }} />
        <PrimaryButton title="Escanear QR" onPress={() => navigation.navigate('StudentQr')} />
        <View style={{ height: 10 }} />
        <SecondaryButton title="Horario" onPress={() => navigation.navigate('StudentSchedule')} />
        <View style={{ height: 10 }} />
        <SecondaryButton title="Cerrar sesión" onPress={() => {
          logout();
          navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        }} />
      </Card>
    </Screen>
  );
}
