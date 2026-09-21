import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';

import { getPalette } from './theme';
import {
  loadAppSettings,
  saveAppSettings,
} from '../utils/appSettings';
import {
  applyDeviceNotificationPreference,
} from '../utils/localNotify';

const ThemeContext = createContext(null);

function ThemeFlash({ scheme }) {
  const opacity = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    opacity.value = 0.42;
    opacity.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [opacity, scheme]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: scheme === 'dark' ? '#000000' : '#FFFFFF' },
        style,
      ]}
    />
  );
}

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [themePref, setThemePref] = useState('light');
  const [inAppNotifications, setInAppState] = useState(true);
  const [deviceNotifications, setDeviceState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadAppSettings();
      if (cancelled) return;
      setThemePref(saved.theme);
      setInAppState(saved.inAppNotifications);
      setDeviceState(saved.deviceNotifications);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = themePref === 'system' ? systemScheme : themePref;
  const colors = useMemo(() => getPalette(resolved), [resolved]);

  useEffect(() => {
    if (!ready) return;
    if (typeof Appearance.setColorScheme !== 'function') return;
    // Android rejects null; "unspecified" vuelve al esquema del sistema.
    const style = themePref === 'light' || themePref === 'dark' ? themePref : 'unspecified';
    try {
      Appearance.setColorScheme(style);
    } catch {
      // ignore
    }
  }, [ready, themePref]);

  const setTheme = useCallback(async (pref) => {
    const next = pref === 'light' || pref === 'dark' ? pref : 'system';
    setThemePref(next);
    await saveAppSettings({ theme: next });
  }, []);

  const setInAppNotifications = useCallback(async (enabled) => {
    const value = Boolean(enabled);
    setInAppState(value);
    await saveAppSettings({ inAppNotifications: value });
  }, []);

  const setDeviceNotifications = useCallback(async (enabled) => {
    const value = Boolean(enabled);
    if (value) {
      await saveAppSettings({ deviceNotifications: true });
      const result = await applyDeviceNotificationPreference(true);
      if (!result.ok && result.reason === 'permission') {
        await saveAppSettings({ deviceNotifications: false });
        setDeviceState(false);
        return { ok: false, reason: 'permission' };
      }
      setDeviceState(true);
      return { ok: true, reason: result.reason };
    }
    await saveAppSettings({ deviceNotifications: false });
    setDeviceState(false);
    await applyDeviceNotificationPreference(false);
    return { ok: true };
  }, []);

  const navigationTheme = useMemo(() => {
    const base = resolved === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    };
  }, [colors, resolved]);

  const value = useMemo(
    () => ({
      ready,
      colors,
      themePref,
      resolved,
      setTheme,
      inAppNotifications,
      setInAppNotifications,
      deviceNotifications,
      setDeviceNotifications,
      navigationTheme,
    }),
    [
      colors,
      deviceNotifications,
      inAppNotifications,
      navigationTheme,
      ready,
      resolved,
      setDeviceNotifications,
      setInAppNotifications,
      setTheme,
      themePref,
    ]
  );

  const fallbackBg = getPalette(systemScheme).background;

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: fallbackBg }} />;
  }

  return (
    <ThemeContext.Provider value={value}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {children}
        <ThemeFlash scheme={resolved} />
      </View>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      ready: false,
      colors: getPalette('light'),
      themePref: 'light',
      resolved: 'light',
      setTheme: async () => {},
      inAppNotifications: true,
      setInAppNotifications: async () => {},
      deviceNotifications: true,
      setDeviceNotifications: async () => {},
      navigationTheme: DefaultTheme,
    };
  }
  return ctx;
}

export function useColors() {
  return useAppTheme().colors;
}

export function useThemedStyles(factory) {
  const colors = useColors();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}
