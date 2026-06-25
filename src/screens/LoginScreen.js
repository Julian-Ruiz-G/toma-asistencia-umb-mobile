import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Card, Input, Label, PrimaryButton, Screen, SecondaryButton } from '../ui/components';
import { useAuth } from '../state/auth';
import { LOGIN_TEACHER_URL, LOGIN_STUDENT_URL } from '../config';

export default function LoginScreen({ navigation }) {
  const { setAuthToken, setRole, setEmail, setStudentCode: setStudentCodeAuth, setTeacherCode: setTeacherCodeAuth } = useAuth();
  const [loginRole, setLoginRole] = useState('student');
  const [email, setEmailLocal] = useState('');
  const [password, setPassword] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [studentCode, setStudentCode] = useState('');

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !password.trim()) {
      Alert.alert('Faltan datos', 'Ingresa correo y contraseña.');
      return;
    }

    const isTeacher = loginRole === 'teacher';
    const url = isTeacher ? LOGIN_TEACHER_URL : LOGIN_STUDENT_URL;
    if (!url) {
      Alert.alert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }

    try {
      const body = isTeacher
        ? { email: e, teacherCode: teacherCode.trim(), password: password.trim() }
        : { email: e, studentCode: studentCode.trim(), password: password.trim() };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      const token = json?.authToken || '';
      const role = json?.role || '';
      if (!token) throw new Error('authToken inválido');
      if (role !== 'teacher' && role !== 'student') throw new Error('role inválido');
      setAuthToken(token);
      setRole(role);
      setEmail(e);
      if (role === 'student') {
        setStudentCodeAuth(studentCode.trim());
        setTeacherCodeAuth('');
      } else {
        setTeacherCodeAuth(teacherCode.trim());
        setStudentCodeAuth('');
      }

      navigation.reset({ index: 0, routes: [{ name: role === 'teacher' ? 'TeacherHome' : 'StudentHome' }] });
    } catch (err) {
      Alert.alert('Error', err?.message || String(err));
    }
  };

  return (
    <Screen title="Iniciar sesión" onBack={() => navigation.goBack()}>
      <Card>
        <Label>Rol</Label>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              title="Estudiante"
              onPress={() => setLoginRole('student')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              title="Docente"
              onPress={() => setLoginRole('teacher')}
            />
          </View>
        </View>

        <Label>Correo</Label>
        <Input value={email} onChangeText={setEmailLocal} placeholder="correo@umb.edu.co" autoCapitalize="none" keyboardType="email-address" />

        {loginRole === 'teacher' ? (
          <>
            <Label>Código docente</Label>
            <Input value={teacherCode} onChangeText={setTeacherCode} placeholder="Ej: 1234" autoCapitalize="none" />
          </>
        ) : (
          <>
            <Label>Código estudiante (opcional)</Label>
            <Input value={studentCode} onChangeText={setStudentCode} placeholder="Ej: 20231045892" autoCapitalize="none" />
          </>
        )}

        <Label>Contraseña</Label>
        <Input value={password} onChangeText={setPassword} placeholder="******" secureTextEntry autoCapitalize="none" />
        <View style={{ height: 16 }} />
        <PrimaryButton title="Entrar" onPress={submit} />
        <View style={{ height: 10 }} />
        <SecondaryButton title="Crear cuenta" onPress={() => navigation.navigate('Register')} />
      </Card>
    </Screen>
  );
}
