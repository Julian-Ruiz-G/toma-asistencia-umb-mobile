import React, { useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

/**
 * Fondo de las ventanas (avisos, formularios en Modal): tocar o deslizar fuera del contenido la cierra.
 * Con un Pressable solo contaba el toque; un deslizamiento a veces se tomaba como cancelado.
 */
export default function OverlayDismiss({ onClose, children, style, pin = 'center' }) {
  const bottom = pin === 'bottom';
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!onCloseRef.current,
      onMoveShouldSetPanResponder: () => !!onCloseRef.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => onCloseRef.current?.(),
    })
  ).current;

  return (
    <View style={[styles.root, style]}>
      {onClose ? (
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onAccessibilityTap={() => onCloseRef.current?.()}
          style={styles.hit}
          {...pan.panHandlers}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[styles.content, bottom ? styles.contentBottom : styles.contentCenter]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  contentCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 32,
  },
  contentBottom: {
    justifyContent: 'flex-end',
  },
});
