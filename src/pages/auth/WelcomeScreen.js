import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { COLORS } from '../../ui/theme';

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.logoGlow} />
          <View style={styles.logoWrap}>
            <Image
              source={require('../../../assets/escudo_umb.png')}
              style={styles.logo}
            />
          </View>
          <Text style={styles.title}>Toma Asistencia UMB</Text>
          <Text style={styles.subtitle}>Sistema de control de asistencia</Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardText}>Elige una opción para continuar</Text>
          <View style={{ height: 16 }} />
          <Button fullWidth size="lg" onPress={() => navigation.navigate('Login')}>Iniciar sesión</Button>
          <View style={{ height: 12 }} />
          <Button fullWidth size="lg" variant="outline" onPress={() => navigation.navigate('Register')}>Registrarse</Button>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 64,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logoGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(185, 28, 28, 0.10)',
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    overflow: 'hidden',
  },
  logo: { width: 78, height: 78, resizeMode: 'contain' },
  title: {
    marginTop: 22,
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  card: { padding: 22 },
  cardText: { color: '#374151', fontSize: 16 },
});
