import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { COLORS } from '../../ui/theme';

export default function WelcomeScreen({ navigation }) {
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslate = useRef(new Animated.Value(14)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(10)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(logoTranslate, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(textTranslate, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(cardTranslate, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.16, duration: 1800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.1, duration: 1800, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [cardOpacity, cardTranslate, glowOpacity, glowScale, logoOpacity, logoTranslate, textOpacity, textTranslate]);

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Animated.View
            style={[
              styles.logoGlow,
              { opacity: glowOpacity, transform: [{ scale: glowScale }] },
            ]}
          />
          <Animated.View
            style={{
              opacity: logoOpacity,
              transform: [{ translateY: logoTranslate }],
              alignItems: 'center',
            }}
          >
            <View style={styles.logoWrap}>
              <Image
                source={require('../../../assets/escudo_umb.png')}
                style={styles.logo}
              />
            </View>
          </Animated.View>
          <Animated.View
            style={{
              opacity: textOpacity,
              transform: [{ translateY: textTranslate }],
              alignItems: 'center',
            }}
          >
            <Text style={styles.brand}>Universidad Manuela Beltrán</Text>
            <Text style={styles.title}>Toma Asistencia UMB</Text>
            <Text style={styles.subtitle}>Sistema de control de asistencia</Text>
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardTranslate }] }}>
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
