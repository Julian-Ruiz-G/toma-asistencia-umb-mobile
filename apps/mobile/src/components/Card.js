import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors } from '../ui/ThemeContext';

export function Card({ children, style }) {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

function makeStyles(COLORS) {
  return StyleSheet.create({
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: COLORS.black,
      shadowOpacity: COLORS.scheme === 'dark' ? 0.35 : 0.10,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
  });
}
