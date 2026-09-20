import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarOff, Clock, Info } from 'lucide-react-native';

import { COLORS } from '../ui/theme';

let showFn = null;

export function bindHoursNotice(fn) {
  showFn = fn;
}

export function showHoursNotice(notice) {
  if (typeof showFn === 'function') {
    showFn(notice);
    return true;
  }
  return false;
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

const ICONS = {
  offday: CalendarOff,
  early: Clock,
  late: Clock,
};

export function HoursNoticeHost() {
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    bindHoursNotice(setNotice);
    return () => bindHoursNotice(null);
  }, []);
  const Icon = ICONS[notice?.kind] || Info;
  return (
    <Modal visible={!!notice} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Aviso de horario</Text>
          <View style={styles.iconWrap}>
            <Icon size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{notice?.title}</Text>
          {notice?.subtitle ? <Text style={styles.subtitle}>{notice.subtitle}</Text> : null}
          <View style={styles.points}>
            {(notice?.points || []).map((p) => (
              <View key={p} style={styles.pointRow}>
                <View style={styles.dot} />
                <Text style={styles.point}>{p}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={() => setNotice(null)} style={styles.btn}>
            <Text style={styles.btnText}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.5)',
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
  },
  kicker: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(185,28,28,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#111827', textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  points: { marginTop: 16, gap: 10 },
  pointRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6 },
  point: { flex: 1, color: '#374151', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  btn: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
