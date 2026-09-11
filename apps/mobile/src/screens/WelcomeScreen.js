import React from 'react';
import { View, Text } from 'react-native';
import { Card, PrimaryButton, Screen, SecondaryButton } from '../ui/components';

export default function WelcomeScreen({ navigation }) {
  return (
    <Screen title="Bienvenido">
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800' }}>Toma Asistencia UMB</Text>
        <Text style={{ marginTop: 8, color: '#6B7280' }}>Ingresa o regístrate para continuar.</Text>
        <View style={{ height: 16 }} />
        <PrimaryButton title="Iniciar sesión" onPress={() => navigation.navigate('Login')} />
        <View style={{ height: 10 }} />
        <SecondaryButton title="Registrarse" onPress={() => navigation.navigate('Register')} />
      </Card>
    </Screen>
  );
}
