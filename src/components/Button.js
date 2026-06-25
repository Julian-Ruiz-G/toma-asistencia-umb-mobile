import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../ui/theme';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  onPress,
}) {
  const isDisabled = !!disabled || !!isLoading;

  const variantStyle =
    variant === 'primary' ? styles.primary :
    variant === 'secondary' ? styles.secondary :
    variant === 'outline' ? styles.outline :
    styles.ghost;

  const textStyle =
    variant === 'outline' ? styles.textOutline :
    variant === 'ghost' ? styles.textGhost :
    styles.textSolid;

  const sizeStyle =
    size === 'sm' ? styles.sm :
    size === 'lg' ? styles.lg :
    styles.md;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyle,
        sizeStyle,
        fullWidth ? styles.fullWidth : null,
        isDisabled ? styles.disabled : null,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? COLORS.primary : '#fff'} />
      ) : null}
      <View style={{ marginLeft: isLoading ? 8 : 0 }}>
        <Text style={[styles.textBase, textStyle]}>{children}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.6 },
  primary: {
    backgroundColor: COLORS.primary,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  secondary: {
    backgroundColor: COLORS.blue,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  outline: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  sm: { paddingVertical: 8, paddingHorizontal: 16 },
  md: { paddingVertical: 12, paddingHorizontal: 24 },
  lg: { paddingVertical: 14, paddingHorizontal: 28 },
  textBase: { fontWeight: '700', fontSize: 16 },
  textSolid: { color: '#fff' },
  textOutline: { color: COLORS.primary },
  textGhost: { color: '#4B5563' },
});
