import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, KeyRound } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { useColors } from '../../ui/ThemeContext';

// La recuperación de cuentas la hace el administrador: asigna una contraseña temporal
// desde el panel y la app obliga a cambiarla en el siguiente inicio de sesión.
const STEPS = [
  'Escribe al administrador de la plataforma desde tu correo institucional.',
  'Indica tu nombre completo y tu código estudiantil o de docente.',
  'El administrador te entregará una contraseña temporal.',
  'Inicia sesión con ella: la app te pedirá crear una contraseña nueva.',
];

export default function ForgotPasswordScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Olvidé mi contraseña</Text>
          <Text style={styles.headerSubtitle}>El administrador restablece el acceso.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <KeyRound size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>¿Cómo recupero mi cuenta?</Text>
          {STEPS.map((step, i) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <View style={{ height: 8 }} />
          <Button fullWidth size="lg" onPress={() => navigation.goBack()}>
            Volver a iniciar sesión
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: COLORS.card,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { marginTop: 2, fontSize: 13, color: COLORS.textSecondary },
  body: { padding: 20 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
    marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    overflow: 'hidden',
  },
  stepText: { flex: 1, color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
});
