import React from 'react';
import { Text, View } from 'react-native';
import { COLORS } from '../ui/theme';
import { Card, PrimaryButton, Screen } from '../ui/components';
import QRCode from 'react-native-qrcode-svg';

export default function TeacherAttendanceQr({ navigation, route }) {
  const attendance = route?.params?.attendance;

  return (
    <Screen title="QR Asistencia" onBack={() => navigation.goBack()}>
      <Card>
        <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>Escanea para registrar asistencia</Text>
        <Text style={{ marginTop: 6, color: COLORS.muted }}>Corte: {attendance?.corte || ''}</Text>

        {attendance?.attendanceToken ? (
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <QRCode value={attendance.attendanceToken} size={240} />
          </View>
        ) : (
          <Text style={{ marginTop: 14, color: COLORS.muted }}>attendanceToken inválido</Text>
        )}

        <View style={{ height: 16 }} />
        <PrimaryButton title="Volver" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}
