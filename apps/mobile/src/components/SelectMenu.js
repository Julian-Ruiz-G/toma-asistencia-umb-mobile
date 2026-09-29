import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';

import { useColors } from '../ui/ThemeContext';

/**
 * Menú desplegable que se abre en el mismo lugar (sin Modal, así funciona también dentro de uno).
 * options: [{ id, label, meta?, group? }]. Las opciones con el mismo `group` se muestran bajo un título.
 */
export default function SelectMenu({ options, value, onChange, placeholder = 'Selecciona una opción' }) {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.id) === String(value));
  const Chevron = open ? ChevronUp : ChevronDown;

  let lastGroup = null;
  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[styles.field, open ? styles.fieldOpen : null]}
        accessibilityRole="button"
      >
        <Text style={selected ? styles.value : styles.placeholder} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        {selected?.meta ? <Text style={styles.fieldMeta}>{selected.meta}</Text> : null}
        <Chevron size={18} color={COLORS.muted} />
      </Pressable>

      {open ? (
        <View style={styles.list}>
          {options.map((o) => {
            const header = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group || lastGroup;
            const active = String(o.id) === String(value);
            return (
              <View key={String(o.id)}>
                {header ? <Text style={styles.group}>{header}</Text> : null}
                <Pressable
                  onPress={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  style={[styles.option, active ? styles.optionActive : null]}
                >
                  <Text style={[styles.optionText, active ? styles.optionTextActive : null]} numberOfLines={2}>
                    {o.label}
                  </Text>
                  {o.meta ? <Text style={styles.optionMeta}>{o.meta}</Text> : null}
                  {active ? <Check size={16} color={COLORS.primary} /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(COLORS) {
  return StyleSheet.create({
    wrapper: { width: '100%' },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    fieldOpen: { borderColor: COLORS.primary },
    value: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.text },
    placeholder: { flex: 1, fontSize: 14, color: COLORS.muted },
    fieldMeta: { fontSize: 12, fontWeight: '800', color: COLORS.muted },
    list: {
      marginTop: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    group: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 2,
      fontSize: 11,
      fontWeight: '900',
      color: COLORS.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    option: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
    optionActive: { backgroundColor: COLORS.primarySoft },
    optionText: { flex: 1, fontSize: 14, color: COLORS.text },
    optionTextActive: { fontWeight: '800', color: COLORS.primary },
    optionMeta: { fontSize: 12, fontWeight: '800', color: COLORS.muted, fontVariant: ['tabular-nums'] },
  });
}
