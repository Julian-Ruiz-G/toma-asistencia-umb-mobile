import React, { useEffect, useState, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import Animated, { PulseGlow, enterDown, enterFade } from '../../ui/motion';

export default function SplashScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { ready, authToken, role } = useAuth();
  const [progress, setProgress] = useState(0);

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
      <PulseGlow
        style={styles.logoGlow}
        fromOpacity={0.12}
        toOpacity={0.22}
        fromScale={1}
        toScale={1.05}
        duration={2000}
      />
      <Animated.View entering={enterFade(0, 320)} style={styles.hero}>
        <Animated.View entering={enterDown(40)}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../../../assets/escudo_umb.png')}
              style={styles.logo}
            />
          </View>
        </Animated.View>

        <Animated.View entering={enterDown(100)} style={styles.center}>
          <Text style={styles.title}>Toma Asistencia UMB</Text>
          <Text style={styles.subtitle}>Universidad Manuela Beltrán</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View entering={enterDown(160)} style={styles.progressWrap}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.dots}>
          <View style={[styles.dot, { opacity: 0.9 }]} />
          <View style={[styles.dot, { opacity: 0.7 }]} />
          <View style={[styles.dot, { opacity: 0.5 }]} />
        </View>
      </Animated.View>

      <Text style={styles.version}>v1.0.0  ·  Uso interno UMB</Text>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
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
  center: { alignItems: 'center' },
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
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOpacity: 0.2,
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
    color: COLORS.white,
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
    backgroundColor: COLORS.card,
    borderRadius: 999,
  },
  dots: { marginTop: 24, flexDirection: 'row', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.card, marginHorizontal: 6 },
  version: {
    position: 'absolute',
    bottom: 32,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },
});
