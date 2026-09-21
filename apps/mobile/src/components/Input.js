import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CircleAlert, Eye, EyeOff } from 'lucide-react-native';
import { useColors } from '../ui/ThemeContext';

export function Input({
  label,
  error,
  helperText,
  secureTextEntry,
  hideErrorText,
  ...props
}) {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = !!secureTextEntry;
  const effectiveSecure = isPassword ? !showPassword : false;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputContainer, error ? styles.inputError : styles.inputOk]}>
        <TextInput
          style={[styles.input, isPassword ? styles.inputWithIcon : null]}
          placeholderTextColor={COLORS.muted}
          secureTextEntry={effectiveSecure}
          {...props}
        />
        {isPassword ? (
          <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
            {showPassword ? (
              <EyeOff size={20} color={COLORS.placeholder} />
            ) : (
              <Eye size={20} color={COLORS.placeholder} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error && !hideErrorText ? (
        <View style={styles.errorBox}>
          <CircleAlert size={15} color={COLORS.primary} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

function makeStyles(COLORS) {
  return StyleSheet.create({
    wrapper: { width: '100%' },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginBottom: 6,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      backgroundColor: COLORS.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    inputOk: { borderColor: COLORS.border },
    inputError: { borderColor: COLORS.dangerStrong, backgroundColor: COLORS.dangerSoft },
    input: {
      flex: 1,
      fontSize: 16,
      color: COLORS.text,
    },
    inputWithIcon: { paddingRight: 8 },
    eyeBtn: { paddingLeft: 8, paddingVertical: 2 },
    errorBox: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: COLORS.dangerSoft,
      borderWidth: 1,
      borderColor: COLORS.dangerBorder,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    error: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.danger, fontWeight: '600' },
    helper: { marginTop: 6, fontSize: 13, color: COLORS.muted },
  });
}
