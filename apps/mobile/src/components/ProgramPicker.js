import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';

import { useColors } from '../ui/ThemeContext';
import { FACULTIES, findProgram, semestersLabel } from '../utils/programs';

/**
 * Menú desplegable de carreras agrupadas por facultad.
 * Se despliega dentro del formulario (no en un Modal): en iOS no se puede abrir un Modal
 * encima de otro, y el perfil del estudiante ya se edita dentro de uno.
 */
export default function ProgramPicker({ label, value, onChange, error }) {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [open, setOpen] = useState(false);
  const selected = findProgram(value);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[styles.field, error ? styles.fieldError : null, open ? styles.fieldOpen : null]}
        accessibilityRole="button"
        accessibilityLabel={label || 'Carrera'}
      >
        <View style={{ flex: 1 }}>
          <Text style={selected ? styles.value : styles.placeholder} numberOfLines={2}>
            {selected ? selected.name : 'Selecciona tu carrera'}
          </Text>
          {selected ? <Text style={styles.meta}>{semestersLabel(selected)}</Text> : null}
        </View>
        <Chevron size={20} color={COLORS.muted} />
      </Pressable>

      {!selected && value && !open ? (
        <Text style={styles.warn}>“{value}” no está en el listado. Elige tu carrera.</Text>
      ) : null}

      {open ? (
        <View style={styles.list}>
          {FACULTIES.map((faculty) => (
            <View key={faculty.name}>
              <Text style={styles.faculty}>{faculty.name}</Text>
              {faculty.programs.map((p) => {
                const active = selected?.name === p.name;
                return (
                  <Pressable
                    key={p.snies}
                    onPress={() => {
                      onChange(p.name, p);
                      setOpen(false);
                    }}
                    style={[styles.option, active ? styles.optionActive : null]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{p.name}</Text>
                      <Text style={styles.optionMeta}>{semestersLabel(p)}</Text>
                    </View>
                    {active ? <Check size={18} color={COLORS.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(COLORS) {
  return StyleSheet.create({
    wrapper: { width: '100%' },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    fieldOpen: { borderColor: COLORS.primary },
    fieldError: { borderColor: COLORS.dangerStrong, backgroundColor: COLORS.dangerSoft },
    value: { fontSize: 16, color: COLORS.text },
    placeholder: { fontSize: 16, color: COLORS.muted },
    meta: { marginTop: 2, fontSize: 12, color: COLORS.muted },
    warn: { marginTop: 6, fontSize: 12, color: COLORS.dangerStrong, fontWeight: '700' },
    list: {
      marginTop: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      paddingVertical: 6,
      overflow: 'hidden',
    },
    faculty: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 4,
      fontSize: 11,
      fontWeight: '900',
      color: COLORS.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
    optionActive: { backgroundColor: COLORS.primarySoft },
    optionText: { fontSize: 15, color: COLORS.text },
    optionTextActive: { fontWeight: '800', color: COLORS.primary },
    optionMeta: { marginTop: 1, fontSize: 12, color: COLORS.muted },
  });
}
