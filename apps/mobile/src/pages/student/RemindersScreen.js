import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../ui/appNotice';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Bell, Clock, Pencil, Plus, Trash2 } from 'lucide-react-native';

import OverlayDismiss from '../../components/OverlayDismiss';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import Animated, { enterDown, listEnter } from '../../ui/motion';
import { useAuth } from '../../state/auth';
import {
  loadReminders,
  nextOccurrence,
  reminderDates,
  reminderIsPast,
  reminderOccurrences,
  saveReminders,
  toIsoDate,
} from '../../utils/remindersStore';
import { isDeviceNotificationsEnabled } from '../../utils/appSettings';
import {
  cancelReminderNotification,
  ensureNotificationPermission,
  isExpoGo,
  scheduleReminderNotification,
} from '../../utils/localNotify';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const WEEKDAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function upcomingDays(count = 21) {
  const out = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push(d);
  }
  return out;
}

function dayLabel(date) {
  return `${WEEKDAY[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
}

function formatDatesLabel(item) {
  const dates = reminderDates(item);
  const parts = dates.map((iso) => {
    const [y, m, d] = String(iso).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${WEEKDAY[dt.getDay()]} ${d}/${m}`;
  });
  const days = parts.length <= 3
    ? parts.join(', ')
    : `${parts.slice(0, 2).join(', ')} y ${parts.length - 2} más`;
  return `${days} · ${item.time || ''}`.trim();
}

async function scheduledIdsFor(item, allowed) {
  if (!allowed) return [];
  const ids = [];
  for (const occ of reminderOccurrences(item)) {
    const nid = await scheduleReminderNotification({
      id: item.id,
      title: item.title,
      description: item.description,
      when: occ.when,
    });
    if (nid) ids.push(nid);
  }
  return ids;
}

function TimePickerModal({ visible, hour, minute, onChange, onClose }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <OverlayDismiss style={styles.modalBackdrop} pin="bottom" onClose={onClose}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>¿A qué hora te avisamos?</Text>
          <Text style={styles.modalPreview}>{hour}:{minute}</Text>
          <View style={styles.wheels}>
            <ScrollView style={styles.wheel} showsVerticalScrollIndicator={false}>
              {HOURS.map((h) => (
                <Pressable
                  key={h}
                  onPress={() => onChange(h, minute)}
                  style={[styles.wheelItem, hour === h ? styles.wheelItemActive : null]}
                >
                  <Text style={[styles.wheelText, hour === h ? styles.wheelTextActive : null]}>{h}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.wheelColon}>:</Text>
            <ScrollView style={styles.wheel} showsVerticalScrollIndicator={false}>
              {MINUTES.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => onChange(hour, m)}
                  style={[styles.wheelItem, minute === m ? styles.wheelItemActive : null]}
                >
                  <Text style={[styles.wheelText, minute === m ? styles.wheelTextActive : null]}>{m}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Button fullWidth onPress={onClose}>Listo</Button>
        </View>
      </OverlayDismiss>
    </Modal>
  );
}

export default function RemindersScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { email } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDates, setSelectedDates] = useState(() => [toIsoDate(new Date())]);
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [timeOpen, setTimeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => upcomingDays(21), []);

  const refresh = useCallback(async () => {
    const list = await loadReminders(email);
    const sorted = [...list].sort((a, b) => {
      const da = nextOccurrence(a)?.when?.getTime() || 0;
      const db = nextOccurrence(b)?.when?.getTime() || 0;
      return da - db;
    });
    setItems(sorted);
  }, [email]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedDates([toIsoDate(new Date())]);
    setHour('08');
    setMinute('00');
    setEditingId(null);
    setShowForm(false);
    setTimeOpen(false);
  };

  const openCreate = () => {
    setTitle('');
    setDescription('');
    setSelectedDates([toIsoDate(new Date())]);
    setHour('08');
    setMinute('00');
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    const dates = reminderDates(item);
    const [hh, mm] = String(item.time || '08:00').split(':');
    setTitle(item.title || '');
    setDescription(item.description || '');
    setSelectedDates(dates.length ? dates : [toIsoDate(new Date())]);
    setHour(String(hh || '08').padStart(2, '0'));
    const rawMin = parseInt(mm, 10);
    const snapped = Number.isFinite(rawMin) ? Math.round(rawMin / 5) * 5 : 0;
    setMinute(String(snapped === 60 ? 0 : snapped).padStart(2, '0'));
    setEditingId(item.id);
    setShowForm(true);
  };

  const toggleDate = (iso) => {
    setSelectedDates((prev) => {
      if (prev.includes(iso)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== iso);
      }
      return [...prev, iso].sort();
    });
  };

  const handleSave = async () => {
    const name = String(title || '').trim();
    if (!name) {
      appAlert('Falta el nombre', 'Escribe qué quieres recordar.');
      return;
    }
    if (!selectedDates.length) {
      appAlert('Elige un día', 'Marca al menos un día para el aviso.');
      return;
    }
    const time = `${hour}:${minute}`;
    const draft = { dates: selectedDates, time };
    const future = reminderOccurrences(draft).filter((o) => o.when.getTime() > Date.now() + 15000);
    if (!future.length) {
      appAlert('Hora pasada', 'Elige al menos un día y una hora posteriores a ahora.');
      return;
    }

    setSaving(true);
    try {
      let allowed = false;
      if (!isExpoGo && isDeviceNotificationsEnabled()) {
        allowed = await ensureNotificationPermission();
        if (!allowed) {
          appAlert(
            'Sin avisos en el celular',
            'Puedes guardar el recordatorio, pero para que suene a esa hora activa las notificaciones del celular en Perfil o en Ajustes.'
          );
        }
      }

      const previous = editingId ? items.find((x) => x.id === editingId) : null;
      if (previous) {
        await cancelReminderNotification(previous.notificationIds || previous.notificationId);
      }

      const id = previous?.id || `rem-${Date.now()}`;
      const payload = {
        id,
        title: name,
        description: String(description || '').trim(),
        dates: [...selectedDates].sort(),
        date: [...selectedDates].sort()[0],
        time,
        read: false,
        createdAt: previous?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      const notificationIds = await scheduledIdsFor(payload, allowed);
      payload.notificationIds = notificationIds;
      payload.notificationId = notificationIds[0] || null;

      const next = previous
        ? items.map((x) => (x.id === id ? payload : x))
        : [...items, payload];
      await saveReminders(email, next);
      setItems(next);
      resetForm();
      appAlert(
        previous ? 'Recordatorio actualizado' : 'Recordatorio guardado',
        `Te avisaremos a las ${time} ${selectedDates.length > 1 ? 'en los días que marcaste' : 'ese día'}.`
      );
    } catch (e) {
      appAlert('Error', e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    appAlert(item.title || 'Recordatorio', '¿Quieres eliminarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await cancelReminderNotification(item.notificationIds || item.notificationId);
          const next = items.filter((x) => x.id !== item.id);
          await saveReminders(email, next);
          setItems(next);
          if (editingId === item.id) resetForm();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={enterDown(0, 360)} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Recordatorios</Text>
          <Text style={styles.headerSubtitle}>Actividades y pendientes</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {showForm ? (
          <Animated.View entering={enterDown(40)} style={styles.card}>
            <Text style={styles.sectionTitle}>
              {editingId ? 'Editar recordatorio' : 'Nuevo recordatorio'}
            </Text>
            <Input
              label="Qué quieres recordar"
              placeholder="Nombre de la actividad"
              value={title}
              onChangeText={setTitle}
            />
            <View style={{ height: 12 }} />
            <Input
              label="Detalles"
              placeholder="Notas, lugar o lo que necesites"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <Text style={styles.fieldLabel}>Días</Text>
            <Text style={styles.fieldHint}>Puedes marcar varios.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              {days.map((d) => {
                const iso = toIsoDate(d);
                const active = selectedDates.includes(iso);
                return (
                  <Pressable
                    key={iso}
                    onPress={() => toggleDate(iso)}
                    style={[styles.dayChip, active ? styles.dayChipActive : null]}
                  >
                    <Text style={[styles.dayChipText, active ? styles.dayChipTextActive : null]}>
                      {dayLabel(d)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.fieldLabel}>Hora del aviso</Text>
            <Pressable onPress={() => setTimeOpen(true)} style={styles.timeButton}>
              <Clock size={20} color={COLORS.primary} />
              <Text style={styles.timeButtonText}>{hour}:{minute}</Text>
              <Text style={styles.timeButtonHint}>Cambiar</Text>
            </Pressable>
            <View style={{ height: 14 }} />
            <Button fullWidth onPress={handleSave} isLoading={saving}>
              {editingId ? 'Guardar cambios' : 'Guardar'}
            </Button>
            <View style={{ height: 8 }} />
            <Button fullWidth variant="ghost" onPress={resetForm}>Cancelar</Button>
          </Animated.View>
        ) : (
          <Pressable onPress={openCreate} style={styles.addBanner}>
            <Plus size={18} color={COLORS.primary} />
            <Text style={styles.addBannerText}>Agregar actividad o pendiente</Text>
          </Pressable>
        )}

        {items.length === 0 && !showForm ? (
          <View style={styles.empty}>
            <Bell size={36} color={COLORS.placeholder} />
            <Text style={styles.emptyTitle}>Sin recordatorios</Text>
            <Text style={styles.emptyText}>Crea uno y te avisaremos a la hora que elijas.</Text>
          </View>
        ) : null}

        {items.map((item, idx) => {
          const past = reminderIsPast(item);
          return (
            <Animated.View key={item.id} entering={listEnter(idx)} style={[styles.item, past ? styles.itemPast : null]}>
              <Pressable onPress={() => openEdit(item)} style={styles.itemMain}>
                <View style={styles.itemIcon}>
                  <Clock size={18} color={COLORS.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
                  <Text style={styles.itemMeta}>
                    {formatDatesLabel(item)}
                    {past ? ' · ya pasó' : ''}
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => openEdit(item)} style={styles.iconAction} hitSlop={8}>
                <Pencil size={16} color={COLORS.muted} />
              </Pressable>
              <Pressable onPress={() => handleDelete(item)} style={styles.iconAction} hitSlop={8}>
                <Trash2 size={16} color={COLORS.placeholder} />
              </Pressable>
            </Animated.View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      <TimePickerModal
        visible={timeOpen}
        hour={hour}
        minute={minute}
        onChange={(h, m) => {
          setHour(h);
          setMinute(m);
        }}
        onClose={() => setTimeOpen(false)}
      />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 12, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { marginTop: 2, fontSize: 14, color: COLORS.muted },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { fontWeight: '900', color: COLORS.text, marginBottom: 12 },
  fieldLabel: { marginTop: 14, marginBottom: 4, fontWeight: '800', color: COLORS.textSecondary, fontSize: 13 },
  fieldHint: { marginBottom: 8, fontSize: 12, color: COLORS.muted },
  dayRow: { gap: 8, paddingBottom: 6 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
  },
  dayChipActive: { backgroundColor: COLORS.primary },
  dayChipText: { fontWeight: '800', color: COLORS.icon, fontSize: 12 },
  dayChipTextActive: { color: COLORS.white },
  timeButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  timeButtonText: { flex: 1, fontSize: 28, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  timeButtonHint: { fontWeight: '800', color: COLORS.primary, fontSize: 13 },
  addBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  addBannerText: { fontWeight: '800', color: COLORS.primary },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { marginTop: 12, fontWeight: '900', fontSize: 16, color: COLORS.text },
  emptyText: { marginTop: 6, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 24 },
  item: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  itemPast: { opacity: 0.55 },
  itemMain: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { fontWeight: '900', color: COLORS.text },
  itemDesc: { marginTop: 4, color: COLORS.muted, fontSize: 13 },
  itemMeta: { marginTop: 6, color: COLORS.placeholder, fontSize: 12, fontWeight: '700' },
  iconAction: { padding: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 28,
  },
  modalTitle: { fontWeight: '900', fontSize: 16, color: COLORS.text, textAlign: 'center' },
  modalPreview: {
    marginTop: 8,
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    height: 220,
  },
  wheel: { width: 88, maxHeight: 220 },
  wheelColon: { fontSize: 28, fontWeight: '900', color: COLORS.text, marginHorizontal: 8 },
  wheelItem: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 4,
  },
  wheelItemActive: { backgroundColor: COLORS.dangerBg },
  wheelText: { fontSize: 18, fontWeight: '800', color: COLORS.muted },
  wheelTextActive: { color: COLORS.primary },
});
