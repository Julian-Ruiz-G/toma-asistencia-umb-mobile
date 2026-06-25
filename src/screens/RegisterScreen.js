import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Card, Input, Label, PrimaryButton, Screen } from '../ui/components';

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Faltan datos', 'Completa nombre, correo y contraseña.');
      return;
    }
    Alert.alert('Listo', 'Registro UI (pendiente conectar al backend)');
    navigation.navigate('Login');
  };

  return (
    <Screen title="Registro" onBack={() => navigation.goBack()}>
      <Card>
        <Label>Nombre completo</Label>
        <Input value={fullName} onChangeText={setFullName} placeholder="Nombre Apellido" />
        <Label>Correo</Label>
        <Input value={email} onChangeText={setEmail} placeholder="correo@umb.edu.co" autoCapitalize="none" keyboardType="email-address" />
        <Label>Contraseña</Label>
        <Input value={password} onChangeText={setPassword} placeholder="******" secureTextEntry autoCapitalize="none" />
        <View style={{ height: 16 }} />
        <PrimaryButton title="Crear cuenta" onPress={submit} />
      </Card>
    </Screen>
  );
}
