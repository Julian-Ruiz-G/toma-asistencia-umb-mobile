import React from 'react';
import { Text } from 'react-native';
import { COLORS } from '../ui/theme';
import { Card, Screen } from '../ui/components';

export default function StudentSchedule({ navigation }) {
  return (
    <Screen title="Horario" onBack={() => navigation.goBack()}>
      <Card>
        <Text style={{ color: COLORS.muted }}>Pendiente: aquí vamos a pintar el horario semanal real usando /my-classes.</Text>
      </Card>
    </Screen>
  );
}
