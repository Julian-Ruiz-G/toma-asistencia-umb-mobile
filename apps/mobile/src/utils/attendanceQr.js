import { Alert } from 'react-native';

export function alertClassHoursError(json, fallbackText) {
  const code = String(json?.error || '');
  const msg = String(json?.message || json?.details || fallbackText || 'Esta acción solo está permitida en el horario de clase.');
  if (code === 'NotScheduledToday') {
    Alert.alert(
      'Sin clase hoy',
      json?.message || `Hoy (${json?.today || 'hoy'}) esta clase no tiene horario.`
    );
    return true;
  }
  if (code === 'TooEarlyForQR' || code === 'TooLateForQR' || code === 'OutsideSchedule') {
    Alert.alert('Fuera de horario', msg);
    return true;
  }
  return false;
}

export function alertAttendanceQrError(json, fallbackText) {
  return alertClassHoursError(
    json,
    fallbackText || 'No se pudo crear el QR de asistencia.'
  );
}
