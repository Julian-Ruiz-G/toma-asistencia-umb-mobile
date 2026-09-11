import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { COLORS } from '../../ui/theme';

export default function SplashScreen({ navigation }) {
  const { ready, authToken, role } = useAuth();
  const [progress, setProgress] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.06, duration: 1600, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1, duration: 1600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [fade, glowScale]);

  useEffect(() => {
    if (!ready) return undefined;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (authToken && role === 'teacher') navigation.replace('TeacherHome');
            else if (authToken && role === 'admin') navigation.replace('AdminDashboard');
            else if (authToken && role === 'student') navigation.replace('StudentHome');
            else navigation.replace('Welcome');
          }, 300);
          return 100;
        }
        return prev + 4;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [authToken, navigation, ready, role]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.logoGlow, { transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[styles.hero, { opacity: fade }]}>
        <View style={styles.logoWrap}>
          <Image
            source={require('../../../assets/escudo_umb.png')}
            style={styles.logo}
          />
        </View>

        <Text style={styles.title}>Toma Asistencia UMB</Text>
        <Text style={styles.subtitle}>Universidad Manuela Beltrán</Text>
      </Animated.View>

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

      <Text style={styles.version}>v1.0.0  ·  Uso interno UMB</Text>
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
  hero: {
    alignItems: 'center',
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
    fontSize: 16,
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
