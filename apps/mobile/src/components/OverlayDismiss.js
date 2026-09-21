import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function OverlayDismiss({ onClose, children, style, pin = 'center' }) {
  const bottom = pin === 'bottom';
  return (
    <View style={[styles.root, style]}>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={styles.hit}
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
