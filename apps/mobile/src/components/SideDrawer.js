import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, LogOut } from 'lucide-react-native';

import { useColors } from '../ui/ThemeContext';

const SCREEN_W = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(256, Math.round(SCREEN_W * 0.68));
const OPEN_EDGE = 28;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function SideDrawer({
  visible,
  onClose,
  onOpen,
  photoUri,
  fallbackSource,
  roleLabel,
  name,
  items = [],
  onLogout,
}) {
  const COLORS = useColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(visible ? 0 : -DRAWER_WIDTH)).current;
  const startX = useRef(visible ? 0 : -DRAWER_WIDTH);
  const visibleRef = useRef(visible);
  const onCloseRef = useRef(onClose);
  const onOpenRef = useRef(onOpen);
  const settleCloseRef = useRef(() => {});
  const [mounted, setMounted] = useState(visible);

  visibleRef.current = visible;
  onCloseRef.current = onClose;
  onOpenRef.current = onOpen;

  settleCloseRef.current = (dx, vx) => {
    const current = startX.current + dx;
    const shouldClose = current < -DRAWER_WIDTH * 0.22 || vx < -0.35;
    if (shouldClose) onCloseRef.current?.();
    else {
      Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      startX.current = 0;
    }
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      startX.current = 0;
      return undefined;
    }
    Animated.timing(slide, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
    startX.current = -DRAWER_WIDTH;
    return undefined;
  }, [slide, visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current?.();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const openPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => (
        !visibleRef.current
        && g.dx > 8
        && Math.abs(g.dx) > Math.abs(g.dy) * 0.6
      ),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 20 || g.vx > 0.2) onOpenRef.current?.();
      },
      onPanResponderTerminate: (_, g) => {
        if (g.dx > 20 || g.vx > 0.2) onOpenRef.current?.();
      },
    })
  ).current;

  const overlayPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        slide.stopAnimation((v) => { startX.current = v; });
      },
      onPanResponderMove: (_, g) => {
        slide.setValue(clamp(startX.current + g.dx, -DRAWER_WIDTH, 0));
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 12 && Math.abs(g.dy) < 12) {
          onCloseRef.current?.();
          return;
        }
        settleCloseRef.current(g.dx, g.vx);
      },
      onPanResponderTerminate: (_, g) => settleCloseRef.current(g.dx, g.vx),
    })
  ).current;

  const closePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => (
        visibleRef.current
        && g.dx < -10
        && Math.abs(g.dx) > Math.abs(g.dy)
      ),
      onPanResponderGrant: () => {
        slide.stopAnimation((v) => { startX.current = v; });
      },
      onPanResponderMove: (_, g) => {
        slide.setValue(clamp(startX.current + g.dx, -DRAWER_WIDTH, 0));
      },
      onPanResponderRelease: (_, g) => settleCloseRef.current(g.dx, g.vx),
      onPanResponderTerminate: (_, g) => settleCloseRef.current(g.dx, g.vx),
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const go = (item) => {
    setMounted(false);
    onCloseRef.current?.();
    if (typeof item?.onPress === 'function') item.onPress();
  };

  const goLogout = () => {
    setMounted(false);
    onCloseRef.current?.();
    if (typeof onLogout === 'function') onLogout();
  };

  return (
    <>
      {!visible ? (
        <View collapsable={false} style={styles.edge} {...openPan.panHandlers} />
      ) : null}

      <Modal
        visible={mounted}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <View style={styles.modalRoot}>
          <View style={styles.overlaySolid} />
          <View collapsable={false} style={styles.overlayHit} {...overlayPan.panHandlers} />
          <View style={styles.panelHit} {...closePan.panHandlers}>
            <Animated.View
              style={[
                styles.panel,
                {
                  paddingTop: Math.max(insets.top, 16),
                  paddingBottom: Math.max(insets.bottom, 16),
                  transform: [{ translateX: slide }],
                },
              ]}
            >
              <View style={styles.profile}>
                <View style={styles.profileTop}>
                  <View style={styles.avatarWrap}>
                    <Image
                      key={photoUri || 'default'}
                      source={photoUri ? { uri: photoUri } : fallbackSource}
                      style={photoUri ? styles.avatarPhoto : styles.avatar}
                      resizeMode={photoUri ? 'cover' : 'contain'}
                    />
                  </View>
                  <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                    <X size={18} color={COLORS.white} />
                  </Pressable>
                </View>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.role}>{roleLabel}</Text>
              </View>

              <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menu} showsVerticalScrollIndicator={false}>
                {items.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <Pressable key={item.label} onPress={() => go(item)} style={styles.item}>
                      <View style={styles.itemIcon}>
                        {Icon ? <Icon size={18} color={COLORS.icon} /> : null}
                      </View>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {onLogout ? (
                <Pressable onPress={goLogout} style={styles.logoutBtn}>
                  <View style={styles.logoutIcon}>
                    <LogOut size={18} color={COLORS.dangerStrong} />
                  </View>
                  <Text style={styles.logoutLabel}>Cerrar sesión</Text>
                </Pressable>
              ) : null}
            </Animated.View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(COLORS) {
  return StyleSheet.create({
    edge: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: OPEN_EDGE,
      backgroundColor: 'rgba(0,0,0,0.01)',
      zIndex: 8,
    },
    modalRoot: { flex: 1 },
    overlaySolid: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: COLORS.overlay,
    },
    overlayHit: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.01)',
    },
    panelHit: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: DRAWER_WIDTH,
      overflow: 'hidden',
      zIndex: 2,
    },
    panel: {
      width: DRAWER_WIDTH,
      height: '100%',
      backgroundColor: COLORS.card,
      borderRightWidth: 1,
      borderRightColor: COLORS.border,
    },
    profile: {
      backgroundColor: COLORS.primary,
      marginHorizontal: 10,
      marginBottom: 10,
      borderRadius: 16,
      padding: 12,
    },
    profileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    avatarWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatar: { width: 44, height: 44 },
    avatarPhoto: { width: 56, height: 56 },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { marginTop: 12, color: COLORS.white, fontWeight: '900', fontSize: 18 },
    role: { marginTop: 2, color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 13 },
    menuScroll: { flex: 1 },
    menu: { paddingHorizontal: 10, paddingBottom: 8, gap: 2 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 14,
    },
    itemIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: COLORS.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemLabel: { flex: 1, fontWeight: '800', color: COLORS.text, fontSize: 15 },
    logoutBtn: {
      marginHorizontal: 10,
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 14,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    logoutIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: COLORS.dangerBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutLabel: { flex: 1, fontWeight: '800', color: COLORS.dangerStrong, fontSize: 15 },
  });
}
