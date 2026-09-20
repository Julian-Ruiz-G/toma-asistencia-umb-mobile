import { showAppNotice } from '../ui/appNotice';

export { AppNoticeHost as HoursNoticeHost } from '../ui/appNotice';

export function showHoursNotice(notice) {
  if (!notice) return false;
  return showAppNotice({
    ...notice,
    kicker: 'Aviso de horario',
    primaryLabel: 'Entendido',
  });
}

const DAY_ES = {
  MONDAY: 'lunes',
  TUESDAY: 'martes',
  WEDNESDAY: 'miércoles',
  THURSDAY: 'jueves',
  FRIDAY: 'viernes',
  SATURDAY: 'sábado',
  SUNDAY: 'domingo',
};

function todayLabel(raw) {
  const key = String(raw || '').toUpperCase();
  return DAY_ES[key] || '';
}

export function describeHoursError(json) {
  const code = String(json?.error || '');
  const day = todayLabel(json?.today);

  if (code === 'NotScheduledToday') {
    return {
      kind: 'offday',
      title: 'Hoy no hay esta clase',
      subtitle: day ? `Hoy es ${day}` : 'Esta materia no está en el horario de hoy',
      points: [
        'La foto, el QR de asistencia y el tablero en vivo solo se usan el día en que la materia está programada.',
        'Revisa el horario de la clase en el detalle o en Mis clases.',
        'Si el horario está mal, edita la clase y corrige el día y la hora.',
      ],
    };
  }
  if (code === 'TooEarlyForQR' || code === 'TooEarlyForPhoto') {
    const when = json?.scheduledTime ? ` Empieza a las ${json.scheduledTime}.` : '';
    return {
      kind: 'early',
      title: 'Todavía no es la hora',
      subtitle: `Puedes abrir asistencia desde 15 minutos antes del inicio.${when}`,
      points: [
        'Espera a esa ventana o entra cuando la clase ya haya comenzado.',
        'El QR y la foto no se habilitan fuera del bloque de clase.',
      ],
    };
  }
  if (code === 'TooLateForQR' || code === 'OutsideSchedule') {
    return {
      kind: 'late',
      title: 'Fuera del horario de clase',
      subtitle: String(json?.message || 'Esta acción solo está disponible durante la clase.'),
      points: [
        'El QR y la foto se usan desde 15 minutos antes del inicio hasta la hora de fin.',
        'Cuando termine el bloque, revisa el historial o el informe de la sesión.',
      ],
    };
  }
  return null;
}

export function alertClassHoursError(json) {
  const notice = describeHoursError(json);
  if (!notice) return false;
  if (showHoursNotice(notice)) return true;
  return false;
}

export function alertAttendanceQrError(json) {
  return alertClassHoursError(json);
}
