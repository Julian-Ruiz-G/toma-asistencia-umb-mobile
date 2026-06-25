import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../ui/theme';

export default function SplashScreen({ navigation }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => navigation.replace('Welcome'), 300);
          return 100;
        }
        return prev + 4;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <View style={styles.logoGlow} />
      <View style={styles.logoWrap}>
        <Image
          source={require('../../../assets/escudo_umb.png')}
          style={styles.logo}
        />
      </View>

      <Text style={styles.title}>Asistencia inteligente</Text>
      <Text style={styles.subtitle}>Universidad Manuela Beltrán</Text>

      <View style={styles.progressWrap}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.dots}>
          <View style={[styles.dot, { opacity: 0.9 }]} />
          <View style={[styles.dot, { opacity: 0.7 }]} />
          <View style={[styles.dot, { opacity: 0.5 }]} />
        </View>
      </View>

      <Text style={styles.version}>v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: COLORS.primary,
  },
  logoGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logoWrap: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.20,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
    overflow: 'hidden',
  },
  logo: { width: 112, height: 112, resizeMode: 'contain' },
  title: {
    marginTop: 28,
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 18,
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
  },
  progressWrap: { marginTop: 48, width: '100%', maxWidth: 320 },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 999,
  },
  dots: { marginTop: 24, flexDirection: 'row', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginHorizontal: 6 },
  version: {
    position: 'absolute',
    bottom: 32,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },
});
