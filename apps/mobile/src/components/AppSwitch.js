import React from 'react';
import { Switch } from 'react-native';

import { useColors } from '../ui/ThemeContext';

/** Switch con los colores del tema: en oscuro el riel apagado del sistema casi no se ve. */
export default function AppSwitch(props) {
  const COLORS = useColors();
  const offTrack = COLORS.scheme === 'dark' ? '#78716C' : '#D1D5DB';
  return (
    <Switch
      trackColor={{ false: offTrack, true: COLORS.primary }}
      thumbColor={COLORS.white}
      ios_backgroundColor={offTrack}
      {...props}
    />
  );
}
