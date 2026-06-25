import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Card, Screen } from '../ui/components';

export default function StudentQr({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      if (!permission?.granted) {
        await requestPermission();
      }
    })();
  }, []);

  if (!permission?.granted) {
    return (
      <Screen title="Escanear QR" onBack={() => navigation.goBack()}>
        <Card>
          <Text style={{ color: '#6B7280' }}>Permiso de cámara requerido.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Escanear QR" onBack={() => navigation.goBack()}>
      <Card>
        <Text style={{ marginBottom: 10, color: '#6B7280' }}>Apunta al código QR.</Text>
        <View style={{ height: 360, borderRadius: 16, overflow: 'hidden' }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(res) => {
              if (!enabled) return;
              setEnabled(false);
              Alert.alert('QR leído', String(res?.data || ''), [
                { text: 'OK', onPress: () => setEnabled(true) }
              ]);
            }}
          />
        </View>
      </Card>
    </Screen>
  );
}
