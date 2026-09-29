import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Button } from '../../components/Button';
import JustificationAttachment from '../../components/JustificationAttachment';
import { LIST_JUSTIFICATIONS_URL, REVIEW_JUSTIFICATION_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { appAlert } from '../../ui/appNotice';
import { useColors } from '../../ui/ThemeContext';
import { personDisplayName } from '../../utils/displayName';
import { NavButtons, useTeacherDrawer } from '../../components/RoleDrawer';

const STATUS_LABEL = {
  enviada: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  vencida: 'Vencida',
};

export default function Justifications({ navigation, route }) {
  const classId = String(route?.params?.classId || '');
  const className = String(route?.params?.className || '');
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useTeacherDrawer(navigation, 'TeacherJustifications');
  const { authToken } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!authToken || !LIST_JUSTIFICATIONS_URL) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(LIST_JUSTIFICATIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(classId ? { classId } : {}),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        throw new Error((json && (json.message || json.error)) || text || `HTTP ${resp.status}`);
      }
      setRows(Array.isArray(json?.justifications) ? json.justifications : []);
    } catch (e) {
      appAlert('Error', e?.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authToken, classId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const review = async (row, decision, reviewNote) => {
    if (!REVIEW_JUSTIFICATION_URL || !authToken) return;
    setBusyId(row.id);
    try {
      const resp = await fetch(REVIEW_JUSTIFICATION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          justificationId: row.id,
          decision,
          note: reviewNote || '',
        }),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        throw new Error((json && (json.message || json.error)) || text || `HTTP ${resp.status}`);
      }
      setRejecting(null);
      setNote('');
      appAlert(
        decision === 'approve' ? 'Justificación aprobada' : 'Justificación rechazada',
        decision === 'approve'
          ? 'El estudiante quedó presente en esa sesión.'
          : 'El estudiante verá el motivo en sus notificaciones.'
      );
      await load();
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    } finally {
      setBusyId('');
    }
  };

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <NavButtons onBack={goBack} onMenu={openDrawer} buttonStyle={styles.backBtn} size={24} color={COLORS.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Justificaciones</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {loading ? 'Cargando…' : (className || 'Excusas de tus clases')}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {!loading && rows.length === 0 ? (
          <Text style={styles.empty}>No hay justificaciones en esta clase.</Text>
        ) : null}
        {rows.map((row) => {
          const pending = row.status === 'enviada';
          return (
            <View key={row.id} style={styles.card}>
              <Text style={styles.name}>{personDisplayName(row.studentName, row.studentEmail || 'Estudiante')}</Text>
              <Text style={styles.meta}>{row.className || 'Clase'} · {row.sessionDate || 'Sin fecha'}</Text>
              <Text style={styles.reason}>{row.reason}</Text>
              <JustificationAttachment row={row} onExpired={load} />
              <Text style={styles.status}>{STATUS_LABEL[row.status] || row.status}</Text>
              {row.reviewNote ? <Text style={styles.note}>Nota: {row.reviewNote}</Text> : null}
              {pending ? (
                rejecting === row.id ? (
                  <View>
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder="Motivo del rechazo"
                      placeholderTextColor={COLORS.placeholder}
                      style={styles.input}
                    />
                    <Button fullWidth isLoading={busyId === row.id} onPress={() => review(row, 'reject', note)}>
                      Confirmar rechazo
                    </Button>
                    <View style={{ height: 8 }} />
                    <Button fullWidth variant="outline" onPress={() => { setRejecting(null); setNote(''); }}>
                      Cancelar
                    </Button>
                  </View>
                ) : (
                  <View>
                    <Button fullWidth isLoading={busyId === row.id} onPress={() => review(row, 'approve', '')}>
                      Aprobar
                    </Button>
                    <View style={{ height: 8 }} />
                    <Button fullWidth variant="outline" onPress={() => { setRejecting(row.id); setNote(''); }}>
                      Rechazar
                    </Button>
                  </View>
                )
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: COLORS.card,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { marginTop: 2, fontSize: 13, color: COLORS.textSecondary },
  body: { padding: 20, gap: 12 },
  empty: { color: COLORS.textSecondary, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  name: { fontWeight: '900', color: COLORS.text, fontSize: 16 },
  meta: { marginTop: 4, color: COLORS.textSecondary, fontWeight: '700' },
  reason: { marginTop: 10, color: COLORS.text, fontWeight: '600' },
  status: { marginTop: 8, marginBottom: 8, color: COLORS.primary, fontWeight: '800' },
  note: { marginBottom: 8, color: COLORS.textSecondary },
  input: {
    minHeight: 72,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
});
