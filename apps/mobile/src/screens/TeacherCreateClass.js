import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Card, Input, Label, PrimaryButton, Screen } from '../ui/components';
import { CREATE_CLASS_URL } from '../config';
import { useAuth } from '../state/auth';
import { deriveStartEndFromSchedule, parseScheduleText } from '../utils/schedule';

export default function TeacherCreateClass({ navigation }) {
  const { authToken } = useAuth();
  const [className, setClassName] = useState('');
  const [group, setGroup] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [period, setPeriod] = useState('');
  const [scheduleText, setScheduleText] = useState('');

  const submit = async () => {
    if (!CREATE_CLASS_URL) {
      Alert.alert('API no configurada', 'Configura extra.apiUrl en app.json');
      return;
    }
    if (!authToken) {
      Alert.alert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return;
    }
    if (!className.trim() || !group.trim() || !scheduleText.trim()) {
      Alert.alert('Faltan datos', 'Completa: nombre, grupo, horario.');
      return;
    }

    const schedule = parseScheduleText(scheduleText);
    const derived = deriveStartEndFromSchedule(schedule);
    if (!derived.startTime || !derived.endTime) {
      Alert.alert('Horario inválido', 'Ej: Lunes 08:00-10:00');
      return;
    }

    try {
      const resp = await fetch(CREATE_CLASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          className: className.trim(),
          group: group.trim(),
          startTime: derived.startTime,
          endTime: derived.endTime,
          subjectCode: subjectCode.trim(),
          period: period.trim(),
          schedule,
        })
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      const createdClassId = json?.classId || json?.id || json?.class?.classId || json?.class?.id || '';
      Alert.alert('Listo', 'Clase creada ✅');
      if (createdClassId) {
        navigation.replace('TeacherClassQRScreen', { classId: String(createdClassId) });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    }
  };

  return (
    <Screen title="Crear clase" onBack={() => navigation.goBack()}>
      <Card>
        <Label>Nombre de la clase</Label>
        <Input value={className} onChangeText={setClassName} placeholder="Ej: Programación" />

        <Label>Código asignatura</Label>
        <Input value={subjectCode} onChangeText={setSubjectCode} placeholder="Ej: 090201-152" autoCapitalize="none" />

        <Label>Periodo</Label>
        <Input value={period} onChangeText={setPeriod} placeholder="Ej: 2026-261" autoCapitalize="none" />

        <Label>Grupo</Label>
        <Input value={group} onChangeText={setGroup} placeholder="Ej: 01" autoCapitalize="none" />

        <Label>Horario semanal (Lun-Sáb)</Label>
        <Input
          value={scheduleText}
          onChangeText={setScheduleText}
          placeholder={'Ej:\nLunes 08:00-10:00\nJueves 10:00-12:00'}
          multiline
          style={{ height: 110, textAlignVertical: 'top' }}
          autoCapitalize="none"
        />

        <View style={{ height: 16 }} />
        <PrimaryButton title="Crear" onPress={submit} />
      </Card>
    </Screen>
  );
}
