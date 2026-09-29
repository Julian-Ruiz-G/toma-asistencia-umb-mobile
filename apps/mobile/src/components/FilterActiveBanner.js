import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { useColors } from '../ui/ThemeContext';

export default function FilterActiveBanner({ label, onClear }) {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  return (
    <View style={styles.bar}>
      <Text style={styles.text} numberOfLines={2}>{label}</Text>
      <Pressable onPress={onClear} style={styles.clear} accessibilityLabel="Quitar filtro">
        <Text style={styles.clearText}>Quitar</Text>
        <X size={14} color={COLORS.primary} />
      </Pressable>
    </View>
  );
}

function makeStyles(COLORS) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.primaryBorder,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    text: { flex: 1, color: COLORS.text, fontSize: 12, fontWeight: '800', lineHeight: 16 },
    clear: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingLeft: 6 },
    clearText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  });
}
