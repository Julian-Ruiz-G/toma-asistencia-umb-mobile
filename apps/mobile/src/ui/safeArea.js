import { Platform, StatusBar } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

// Alto real de la barra de estado / muesca / Dynamic Island de este celular.
// La app va de borde a borde, así que cada cabecera debe dejar ese espacio arriba.
const FALLBACK_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 47;

export const SAFE_TOP = Math.round(initialWindowMetrics?.insets?.top ?? FALLBACK_TOP);

/** Espacio superior de una cabecera: la barra del sistema más un margen propio. */
export function headerTop(extra = 12) {
  return SAFE_TOP + extra;
}
