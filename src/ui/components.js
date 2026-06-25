import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { COLORS } from './theme';

export function Screen({ title, onBack, children }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>Volver</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

export function Card({ children }) {
  return <View style={styles.card}>{children}</View>;
}

export function PrimaryButton({ title, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.primaryBtn}>
      <Text style={styles.primaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ title, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.secondaryBtn}>
      <Text style={styles.secondaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Input(props) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={COLORS.placeholder}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  backBtn: { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  backText: { color: COLORS.text, fontWeight: '600' },
  backBtnPlaceholder: { width: 64 },
  body: { flex: 1, padding: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  primaryBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { backgroundColor: COLORS.card, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  secondaryText: { color: COLORS.text, fontWeight: '700' },
  label: { marginTop: 12, marginBottom: 6, color: COLORS.text, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, color: COLORS.text },
});
