import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

/**
 * Fondo de avisos y ventanas flotantes. Tocar fuera del contenido las cierra.
 * El bloque interior reclama el toque para que botones y campos de adentro no cierren la ventana.
 */
export default function OverlayDismiss({ onClose, children, style, pin = 'center' }) {
  const bottom = pin === 'bottom';

  return (
    <Pressable
      style={[styles.root, style, bottom ? styles.contentBottom : styles.contentCenter]}
      onPress={onClose}
      disabled={!onClose}
      accessibilityRole={onClose ? 'button' : undefined}
      accessibilityLabel={onClose ? 'Cerrar' : undefined}
    >
      <Pressable style={bottom ? styles.sheet : styles.dialog} onPress={() => {}}>
        {children}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  contentCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 32,
  },
  contentBottom: {
    justifyContent: 'flex-end',
  },
  dialog: { width: '100%', maxWidth: 360 },
  sheet: { width: '100%' },
});
