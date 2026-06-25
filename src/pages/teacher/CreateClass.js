import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { CLASS_DETAILS_URL, CREATE_CLASS_URL, UPDATE_CLASS_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { deriveStartEndFromSchedule } from '../../utils/schedule';

// ─── Opciones de los desplegables ────────────────────────────────────────────

const DAYS = [
  { label: 'Lunes', value: 'MONDAY' },
  { label: 'Martes', value: 'TUESDAY' },
  { label: 'Miércoles', value: 'WEDNESDAY' },
  { label: 'Jueves', value: 'THURSDAY' },
  { label: 'Viernes', value: 'FRIDAY' },
  { label: 'Sábado', value: 'SATURDAY' },
  { label: 'Domingo', value: 'SUNDAY' },
];

const DAY_LABEL = Object.fromEntries(DAYS.map((d) => [d.value, d.label]));

// Genera horas desde 06:00 hasta 23:00 en intervalos de 30 min
const buildTimes = () => {
  const out = [];
  for (let h = 6; h <= 23; h++) {

    const hh = String(h).padStart(2);
    out.push({ label: `${hh}:00`, value: `${hh}:00` });
  }
  return out;
};
const TIMES = buildTimes();



const GROUPS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'].map((v) => ({
  label: `Grupo ${v}`,
  value: v,
}));

// ─── Componente desplegable genérico ─────────────────────────────────────────

function PickerField({ label, value, options, onChange, placeholder = 'Seleccionar…' }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={pf.wrap}>
      {label ? <Text style={pf.label}>{label}</Text> : null}
      <Pressable
        style={[pf.trigger, open && pf.triggerOpen]}
        onPress={() => setOpen(true)}
      >
        <Text style={[pf.value, !selected && pf.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={18} color="#6B7280" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={pf.overlay} onPress={() => setOpen(false)}>
          <View style={pf.sheet}>
            <View style={pf.sheetHeader}>
              <Text style={pf.sheetTitle}>{label || 'Seleccionar'}</Text>
              <Pressable onPress={() => setOpen(false)} style={pf.closeBtn}>
                <X size={20} color="#6B7280" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {options.map((o) => {
                const isActive = o.value === value;
                return (
                  <TouchableOpacity
                    key={o.value}
                    style={[pf.option, isActive && pf.optionActive]}
                    onPress={() => { onChange(o.value); setOpen(false); }}
                  >
                    <Text style={[pf.optionText, isActive && pf.optionTextActive]}>
                      {o.label}
                    </Text>
                    {isActive && <Check size={16} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const pf = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 6 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  triggerOpen: { borderColor: COLORS.primary },
  value: { fontSize: 15, color: '#111827', fontWeight: '600' },
  placeholder: { color: '#9CA3AF', fontWeight: '400' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  closeBtn: { padding: 6, borderRadius: 999, backgroundColor: '#F3F4F6' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  optionActive: { backgroundColor: 'rgba(185,28,28,0.05)' },
  optionText: { fontSize: 15, color: '#374151' },
  optionTextActive: { color: COLORS.primary, fontWeight: '800' },
});

// ─── Campo de texto simple ────────────────────────────────────────────────────
import { TextInput } from 'react-native';

function TextField({ label, value, onChangeText, placeholder, autoCapitalize = 'sentences' }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={pf.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        autoCapitalize={autoCapitalize}
        style={tf.input}
      />
    </View>
  );
}

const tf = StyleSheet.create({
  input: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
});

// ─── Bloque de horario (un día + hora inicio + hora fin) ──────────────────────

function ScheduleBlock({ block, index, onChange, onRemove, canRemove }) {
  return (
    <View style={sb.card}>
      <View style={sb.header}>
        <View style={sb.pill}>
          <Calendar size={13} color={COLORS.primary} />
          <Text style={sb.pillText}>Bloque {index + 1}</Text>
        </View>
        {canRemove && (
          <Pressable onPress={onRemove} style={sb.removeBtn}>
            <Trash2 size={16} color="#EF4444" />
          </Pressable>
        )}
      </View>

      <PickerField
        label="Día"
        value={block.day}
        options={DAYS}
        onChange={(v) => onChange({ ...block, day: v })}
        placeholder="Seleccionar día…"
      />

      <View style={sb.timeRow}>
        <View style={{ flex: 1 }}>
          <PickerField
            label="Hora inicio"
            value={block.startTime}
            options={TIMES}
            onChange={(v) => onChange({ ...block, startTime: v })}
            placeholder="HH:MM"
          />
        </View>
        <View style={sb.timeSep}>
          <Clock size={16} color="#9CA3AF" />
        </View>
        <View style={{ flex: 1 }}>
          <PickerField
            label="Hora fin"
            value={block.endTime}
            options={TIMES}
            onChange={(v) => onChange({ ...block, endTime: v })}
            placeholder="HH:MM"
          />
        </View>
      </View>
    </View>
  );
}

const sb = StyleSheet.create({
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(185,28,28,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timeSep: { paddingTop: 32, alignItems: 'center' },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────

const EMPTY_BLOCK = () => ({ day: '', startTime: '', endTime: '' });

export default function CreateClass({ navigation, route }) {
  const { authToken } = useAuth();
  const editClassId = route?.params?.classId ? String(route.params.classId) : '';
  const isEdit = Boolean(editClassId);

  const [className, setClassName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [period, setPeriod] = useState('');
  const [group, setGroup] = useState('');
  const [scheduleBlocks, setScheduleBlocks] = useState([EMPTY_BLOCK()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos si es edición
  useEffect(() => {
    if (!isEdit || !CLASS_DETAILS_URL || !authToken) return;
    (async () => {
      try {
        const resp = await fetch(CLASS_DETAILS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ classId: editClassId }),
        });
        const text = await resp.text();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }
        if (!resp.ok) throw new Error((json?.error || json?.message) ?? `HTTP ${resp.status}`);
        const c = json?.class || json;
        setClassName(String(c?.className || c?.name || ''));
        setSubjectCode(String(c?.subjectCode || ''));
        setPeriod(String(c?.period || ''));
        setGroup(String(c?.group || ''));
        const sch = Array.isArray(c?.schedule) ? c.schedule : [];
        if (sch.length > 0) {
          setScheduleBlocks(sch.map((s) => ({
            day: String(s?.day || ''),
            startTime: String(s?.startTime || ''),
            endTime: String(s?.endTime || ''),
          })));
        }
      } catch (e) {
        Alert.alert('Error', e?.message || String(e));
      }
    })();
  }, [authToken, editClassId, isEdit]);

  const updateBlock = (index, newBlock) => {
    setScheduleBlocks((prev) => prev.map((b, i) => (i === index ? newBlock : b)));
  };

  const addBlock = () => setScheduleBlocks((prev) => [...prev, EMPTY_BLOCK()]);

  const removeBlock = (index) =>
    setScheduleBlocks((prev) => prev.filter((_, i) => i !== index));

  const submit = async () => {
    const url = isEdit ? UPDATE_CLASS_URL : CREATE_CLASS_URL;
    if (!url) { Alert.alert('API no configurada', 'Revisa extra.apiUrl en app.json'); return; }
    if (!authToken) { Alert.alert('Sesión inválida', 'Vuelve a iniciar sesión.'); return; }
    if (!className.trim()) { Alert.alert('Faltan datos', 'Ingresa el nombre de la clase.'); return; }
    if (!group) { Alert.alert('Faltan datos', 'Selecciona el grupo.'); return; }

    // Validar bloques
    const validBlocks = scheduleBlocks.filter((b) => b.day && b.startTime && b.endTime);
    if (validBlocks.length === 0) {
      Alert.alert('Horario incompleto', 'Agrega al menos un bloque con día, hora inicio y hora fin.');
      return;
    }
    for (const b of validBlocks) {
      if (b.startTime >= b.endTime) {
        Alert.alert(
          'Horario inválido',
          `En el bloque del ${DAY_LABEL[b.day] || b.day}, la hora de inicio debe ser menor a la hora de fin.`
        );
        return;
      }
    }

    const derived = deriveStartEndFromSchedule(validBlocks);

    setIsSubmitting(true);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          ...(isEdit ? { classId: editClassId } : {}),
          className: className.trim(),
          group: group.trim(),
          startTime: derived.startTime,
          endTime: derived.endTime,
          subjectCode: subjectCode.trim(),
          period: period.trim(),
          schedule: validBlocks,
        }),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) throw new Error((json?.error || json?.message || json?.details) ?? `HTTP ${resp.status}`);

      if (isEdit) {
        Alert.alert('Listo', 'Clase actualizada ✅');
        navigation.goBack();
      } else {
        const createdId = json?.classId || json?.id || json?.class?.classId || '';
        Alert.alert('Listo', 'Clase creada ✅');
        if (createdId) {
          navigation.replace('TeacherClassQRScreen', { classId: String(createdId) });
        } else {
          navigation.goBack();
        }
      }
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{isEdit ? 'Editar clase' : 'Crear clase'}</Text>
          <Text style={styles.headerSubtitle}>
            {isEdit ? 'Actualizar información del curso' : 'Configurar un nuevo curso'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* ── Información general ───────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información general</Text>

          <TextField
            label="Nombre de la clase *"
            value={className}
            onChangeText={setClassName}
            placeholder="Ej: Cálculo Diferencial"
          />

          <TextField
            label="Código asignatura"
            value={subjectCode}
            onChangeText={setSubjectCode}
            placeholder="Ej: 090201-152"
            autoCapitalize="none"
          />

          <TextField
            label="Grupo *"
            value={group}
            onChangeText={setGroup}
            placeholder="Ej: C1, A1, VIR, SIS1"
            autoCapitalize="characters"
          />
        </View>

        {/* ── Horario semanal ───────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Horario semanal</Text>
            <Text style={styles.sectionHint}>{scheduleBlocks.length} bloque{scheduleBlocks.length !== 1 ? 's' : ''}</Text>
          </View>

          {scheduleBlocks.map((block, i) => (
            <ScheduleBlock
              key={i}
              block={block}
              index={i}
              onChange={(nb) => updateBlock(i, nb)}
              onRemove={() => removeBlock(i)}
              canRemove={scheduleBlocks.length > 1}
            />
          ))}

          <Pressable style={styles.addBlockBtn} onPress={addBlock}>
            <Plus size={16} color={COLORS.primary} />
            <Text style={styles.addBlockText}>Agregar otro bloque de horario</Text>
          </Pressable>
        </View>

        {/* ── Botón guardar ─────────────────────────────── */}
        <Button fullWidth size="lg" isLoading={isSubmitting} onPress={submit}>
          {isEdit ? 'Guardar cambios' : 'Crear clase'}
        </Button>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 12, borderRadius: 999 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 13, color: '#6B7280' },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 14,
  },
  sectionHint: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  addBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  addBlockText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },
});
