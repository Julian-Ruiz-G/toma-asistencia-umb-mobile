import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// Siempre negro sobre blanco, con margen claro alrededor (quiet zone), aunque la app esté
// en modo oscuro: sin ese borde claro las cámaras no detectan el código.
const QUIET_ZONE = 16;

export default function ScannableQR({ value, size = 240 }) {
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' }}>
      <QRCode
        value={String(value)}
        size={size}
        color="#000000"
        backgroundColor="#FFFFFF"
        quietZone={QUIET_ZONE}
        ecl="M"
      />
    </View>
  );
}
