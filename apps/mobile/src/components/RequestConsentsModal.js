import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import OverlayDismiss from './OverlayDismiss';
import { Button } from './Button';
import { useColors } from '../ui/ThemeContext';
import { appAlert } from '../ui/appNotice';
import { useAuth } from '../state/auth';
import { requestAllConsents, requestAllSummary } from '../utils/profileGaps';

/**
 * Pide los consentimientos pendientes a estudiantes, docentes o ambos.
 * `pending` = { studentsPending, teachersPending } para mostrar a cuántos les llegará.
 */
export default function RequestConsentsModal({ visible, onClose, pending, onSent }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { authToken } = useAuth();
  const [busy, setBusy] = useState('');

  const students = Number(pending?.studentsPending || 0);
  const teachers = Number(pending?.teachersPending || 0);
  const known = pending != null;

  const send = async (role) => {
    setBusy(role);
    try {
      const result = await requestAllConsents(authToken, role);
      onClose?.();
      appAlert('Solicitud enviada', requestAllSummary(result));
      onSent?.(result);
    } catch (e) {
      appAlert('No se pudo enviar', e?.message || String(e));
    } finally {
      setBusy('');
    }
  };

  const label = (text, count) => (known ? `${text} (${count})` : text);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <OverlayDismiss style={styles.overlay} onClose={onClose}>
        <View style={styles.card}>
          <Text style={styles.title}>Pedir consentimientos</Text>
          <Text style={styles.text}>
            Cada persona con términos, privacidad o biometría pendientes recibe una notificación que la lleva a
            completarlos. A quien ya los tiene al día no se le envía nada.
          </Text>
          <View style={{ height: 14 }} />
          <Button fullWidth isLoading={busy === 'all'} disabled={!!busy} onPress={() => send('all')}>
            {label('Estudiantes y docentes', students + teachers)}
          </Button>
          <View style={{ height: 8 }} />
          <Button fullWidth variant="outline" isLoading={busy === 'student'} disabled={!!busy} onPress={() => send('student')}>
            {label('Solo estudiantes', students)}
          </Button>
          <View style={{ height: 8 }} />
          <Button fullWidth variant="outline" isLoading={busy === 'teacher'} disabled={!!busy} onPress={() => send('teacher')}>
            {label('Solo docentes', teachers)}
          </Button>
          <View style={{ height: 8 }} />
          <Button fullWidth variant="ghost" disabled={!!busy} onPress={onClose}>
            Cancelar
          </Button>
        </View>
      </OverlayDismiss>
    </Modal>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: COLORS.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, width: '100%', maxWidth: 380 },
  title: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  text: { marginTop: 6, color: COLORS.textSecondary, lineHeight: 20 },
});
