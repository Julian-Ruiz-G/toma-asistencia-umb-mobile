import React from 'react';
import { Alert, Text, View } from 'react-native';
import { Card, PrimaryButton, Screen } from '../ui/components';
import QRCode from 'react-native-qrcode-svg';

export default function TeacherAttendanceQr({ navigation, route }) {
  const attendance = route?.params?.attendance;

  return (
    <Screen title="QR Asistencia" onBack={() => navigation.goBack()}>
      <Card>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>Escanea para registrar asistencia</Text>
        <Text style={{ marginTop: 6, color: '#6B7280' }}>Corte: {attendance?.corte || ''}</Text>

        {attendance?.attendanceToken ? (
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <QRCode value={attendance.attendanceToken} size={240} />
          </View>
        ) : (
          <Text style={{ marginTop: 14, color: '#6B7280' }}>attendanceToken inválido</Text>
        )}

        <View style={{ height: 16 }} />
        <PrimaryButton title="Volver" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}
