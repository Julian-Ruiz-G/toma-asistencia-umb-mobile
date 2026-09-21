import * as FileSystem from 'expo-file-system/legacy';

const FILE = `${FileSystem.documentDirectory || ''}umb-app-settings.json`;

export const DEFAULT_APP_SETTINGS = {
  theme: 'light',
  inAppNotifications: true,
  deviceNotifications: true,
};

let cache = { ...DEFAULT_APP_SETTINGS };

export function getAppSettingsCache() {
  return cache;
}

export function isInAppNotificationsEnabled() {
  return cache.inAppNotifications !== false;
}

export function isDeviceNotificationsEnabled() {
  return cache.deviceNotifications !== false;
}

async function readFile() {
  try {
    if (!FileSystem.documentDirectory) return { ...DEFAULT_APP_SETTINGS };
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return { ...DEFAULT_APP_SETTINGS };
    const data = JSON.parse(await FileSystem.readAsStringAsync(FILE));
    return {
      ...DEFAULT_APP_SETTINGS,
      ...(data && typeof data === 'object' ? data : {}),
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export async function loadAppSettings() {
  cache = await readFile();
  if (cache.theme !== 'light' && cache.theme !== 'dark' && cache.theme !== 'system') {
    cache.theme = 'light';
  }
  cache.inAppNotifications = cache.inAppNotifications !== false;
  cache.deviceNotifications = cache.deviceNotifications !== false;
  return { ...cache };
}

export async function saveAppSettings(patch) {
  cache = {
    ...cache,
    ...(patch || {}),
  };
  if (!FileSystem.documentDirectory) return { ...cache };
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(cache));
  return { ...cache };
}
