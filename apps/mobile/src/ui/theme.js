export const LIGHT = {
  scheme: 'light',
  primary: '#B91C1C',
  primaryDark: '#7F1D1D',
  primarySoft: '#FEF2F2',
  primaryBorder: '#FECACA',
  primaryMuted: '#991B1B',

  background: '#F5F6FA',
  surface: '#F3F4F6',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#374151',
  muted: '#6B7280',
  icon: '#4B5563',
  placeholder: '#9CA3AF',
  border: '#E5E7EB',
  overlay: 'rgba(17,24,39,0.50)',
  primaryOverlay: 'rgba(185,28,28,0.45)',
  white: '#FFFFFF',
  black: '#000000',

  success: '#15803D',
  successStrong: '#16A34A',
  successSoft: '#ECFDF5',
  successBg: '#DCFCE7',
  successBorder: '#BBF7D0',

  warning: '#A16207',
  warningStrong: '#D97706',
  warningSoft: '#FFFBEB',
  warningBg: '#FEF3C7',
  warningBorder: '#FDE68A',

  danger: '#B91C1C',
  dangerStrong: '#DC2626',
  dangerSoft: '#FEF2F2',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FECACA',

  info: '#1E40AF',
  infoStrong: '#2563EB',
  infoSoft: '#EFF6FF',
  infoBg: '#DBEAFE',
  infoBorder: '#BFDBFE',

  reminder: '#1E40AF',
  reminderSoft: '#EFF6FF',
  reminderBorder: '#BFDBFE',

  blue: '#2563EB',
  blueDark: '#1D4ED8',
};

export const DARK = {
  scheme: 'dark',
  primary: '#B91C1C',
  primaryDark: '#7F1D1D',
  primarySoft: '#3F1D1D',
  primaryBorder: '#7F1D1D',
  primaryMuted: '#FECACA',

  background: '#0C0A09',
  surface: '#292524',
  card: '#1C1917',
  text: '#F5F5F4',
  textSecondary: '#E7E5E4',
  muted: '#A8A29E',
  icon: '#D6D3D1',
  placeholder: '#A8A29E',
  border: '#57534E',
  overlay: 'rgba(0,0,0,0.62)',
  primaryOverlay: 'rgba(185,28,28,0.50)',
  white: '#FFFFFF',
  black: '#000000',

  success: '#4ADE80',
  successStrong: '#22C55E',
  successSoft: '#14532D',
  successBg: '#14532D',
  successBorder: '#166534',

  warning: '#FBBF24',
  warningStrong: '#F59E0B',
  warningSoft: '#422006',
  warningBg: '#422006',
  warningBorder: '#854D0E',

  danger: '#B91C1C',
  dangerStrong: '#DC2626',
  dangerSoft: '#3F1D1D',
  dangerBg: '#3F1D1D',
  dangerBorder: '#7F1D1D',

  info: '#93C5FD',
  infoStrong: '#60A5FA',
  infoSoft: '#1E3A8A',
  infoBg: '#1E3A8A',
  infoBorder: '#1D4ED8',

  reminder: '#93C5FD',
  reminderSoft: '#1E3A8A',
  reminderBorder: '#1D4ED8',

  blue: '#60A5FA',
  blueDark: '#3B82F6',
};

export function getPalette(scheme) {
  return scheme === 'dark' ? DARK : LIGHT;
}

/** Paleta clara de respaldo para módulos que aún no usan el contexto. */
export const COLORS = LIGHT;
