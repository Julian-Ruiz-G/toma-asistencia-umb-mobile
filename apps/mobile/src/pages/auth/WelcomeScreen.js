import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { COLORS } from '../../ui/theme';
import Animated, { PulseGlow, enterDown } from '../../ui/motion';

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <PulseGlow style={styles.logoGlow} fromOpacity={0.1} toOpacity={0.16} toScale={1.06} />
          <Animated.View entering={enterDown(40)} style={styles.center}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../../assets/escudo_umb.png')}
                style={styles.logo}
              />
            </View>
          </Animated.View>
          <Animated.View entering={enterDown(140)} style={styles.center}>
            <Text style={styles.brand}>Universidad Manuela Beltrán</Text>
            <Text style={styles.title}>Toma Asistencia UMB</Text>
            <Text style={styles.subtitle}>Sistema de control de asistencia</Text>
          </Animated.View>
        </View>

        <Animated.View entering={enterDown(240)}>
          <Card style={styles.card}>
            <Text style={styles.cardText}>Elige una opción para continuar</Text>
            <View style={{ height: 16 }} />
            <Button fullWidth size="lg" onPress={() => navigation.navigate('Login')}>
              Iniciar sesión
            </Button>
            <View style={{ height: 12 }} />
            <Button fullWidth size="lg" variant="outline" onPress={() => navigation.navigate('Register')}>
              Registrarse
            </Button>
          </Card>
        </Animated.View>
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
  center: { alignItems: 'center' },
  logoGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: COLORS.primary,
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
  brand: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
  },
  title: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
  },
  card: { padding: 22 },
  cardText: { color: '#374151', fontSize: 16 },
});
