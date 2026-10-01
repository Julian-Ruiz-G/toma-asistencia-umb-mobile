import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useColors } from '../ui/ThemeContext';
import { getAppSettingsCache, saveAppSettings } from '../utils/appSettings';
import { CLASS_SORT_OPTIONS } from '../utils/schedule';

/** Orden elegido por el docente; se guarda en el teléfono y lo comparten el inicio y "Mis clases". */
export function useClassSort() {
  const read = () => (getAppSettingsCache().classSort === 'alpha' ? 'alpha' : 'schedule');
  const [mode, setModeState] = useState(read);
  useFocusEffect(useCallback(() => setModeState(read()), []));
  const setMode = useCallback((next) => {
    setModeState(next);
    saveAppSettings({ classSort: next }).catch(() => {});
  }, []);
  return [mode, setMode];
}

export default function ClassSortToggle({ value, onChange }) {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Ordenar</Text>
      <View style={styles.segment}>
        {CLASS_SORT_OPTIONS.map((opt) => {
          const active = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={[styles.option, active ? styles.optionActive : null]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(COLORS) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    label: { color: COLORS.muted, fontWeight: '800', fontSize: 12 },
    segment: {
      flexDirection: 'row',
      backgroundColor: COLORS.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 3,
    },
    option: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
    optionActive: { backgroundColor: COLORS.primary },
    optionText: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 12 },
    optionTextActive: { color: COLORS.white },
  });
}
