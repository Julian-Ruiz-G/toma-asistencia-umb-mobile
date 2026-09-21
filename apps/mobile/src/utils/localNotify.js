import { Platform } from 'react-native';
import { COLORS } from '../ui/theme';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { isDeviceNotificationsEnabled } from './appSettings';

export const REMINDER_CHANNEL = 'umb-reminders';

export const isExpoGo = Constants.executionEnvironment === 'storeClient';

const NATIVE_MODULES = [
  'ExpoNotificationScheduler',
  'ExpoNotificationsHandlerModule',
  'ExpoNotificationPermissionsModule',
];

export function canUseNativeNotifications() {
  if (isExpoGo) return false;
  try {
    return NATIVE_MODULES.every((name) => !!requireOptionalNativeModule(name));
  } catch {
    return false;
  }
}

function loadApi() {
  if (!canUseNativeNotifications()) return null;
  try {
    // Subpaths: no cargar el index (evita FCM / Expo Go push token).
    const { scheduleNotificationAsync } = require('expo-notifications/build/scheduleNotificationAsync');
    const { cancelScheduledNotificationAsync } = require('expo-notifications/build/cancelScheduledNotificationAsync');
    let cancelAllScheduledNotificationsAsync = async () => {};
    try {
      cancelAllScheduledNotificationsAsync = require('expo-notifications/build/cancelScheduledNotificationAsync').cancelAllScheduledNotificationsAsync
        || cancelAllScheduledNotificationsAsync;
    } catch {
      // ignore
    }
    try {
      const cancelAll = require('expo-notifications/build/cancelAllScheduledNotificationsAsync');
      if (typeof cancelAll?.cancelAllScheduledNotificationsAsync === 'function') {
        cancelAllScheduledNotificationsAsync = cancelAll.cancelAllScheduledNotificationsAsync;
      }
    } catch {
      // ignore
    }
    const { setNotificationHandler } = require('expo-notifications/build/NotificationsHandler');
    const { addNotificationResponseReceivedListener } = require('expo-notifications/build/NotificationsEmitter');
    const permissions = require('expo-notifications/build/NotificationPermissions');
    const types = require('expo-notifications/build/Notifications.types');
    let setNotificationChannelAsync = async () => null;
    try {
      setNotificationChannelAsync = require('expo-notifications/build/setNotificationChannelAsync').setNotificationChannelAsync;
    } catch {
      // ignore
    }
    return {
      scheduleNotificationAsync,
      cancelScheduledNotificationAsync,
      cancelAllScheduledNotificationsAsync,
      setNotificationHandler,
      addNotificationResponseReceivedListener,
      getPermissionsAsync: permissions.getPermissionsAsync,
      requestPermissionsAsync: permissions.requestPermissionsAsync,
      SchedulableTriggerInputTypes: types.SchedulableTriggerInputTypes,
      AndroidImportance: { HIGH: 4 },
      setNotificationChannelAsync,
    };
  } catch {
    return null;
  }
}

function handlerOptions() {
  const enabled = isDeviceNotificationsEnabled();
  return {
    shouldShowAlert: enabled,
    shouldShowBanner: enabled,
    shouldShowList: enabled,
    shouldPlaySound: enabled,
    shouldSetBadge: enabled,
  };
}

export async function setupLocalNotifications() {
  const api = loadApi();
  if (!api) return false;
  api.setNotificationHandler({
    handleNotification: async () => handlerOptions(),
  });
  if (Platform.OS === 'android') {
    try {
      await api.setNotificationChannelAsync(REMINDER_CHANNEL, {
        name: 'Recordatorios UMB',
        description: 'Avisos de actividades y pendientes del estudiante',
        importance: 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: COLORS.primary,
        sound: 'default',
      });
    } catch {
      // La APK vieja puede no traer canales; no tumbar la app.
    }
  }
  return true;
}

export async function ensureNotificationPermission() {
  const api = loadApi();
  if (!api) return false;
  const current = await api.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const asked = await api.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') return false;
  await setupLocalNotifications();
  return true;
}

export async function cancelAllScheduledNotifications() {
  const api = loadApi();
  if (!api) return;
  try {
    if (typeof api.cancelAllScheduledNotificationsAsync === 'function') {
      await api.cancelAllScheduledNotificationsAsync();
    }
  } catch {
    // ignore
  }
}

export async function applyDeviceNotificationPreference(enabled) {
  const api = loadApi();
  if (!enabled) {
    await cancelAllScheduledNotifications();
    if (api) {
      api.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false,
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    }
    return { ok: true };
  }
  if (isExpoGo || !api) return { ok: true, reason: 'expo-go' };
  const granted = await ensureNotificationPermission();
  if (!granted) return { ok: false, reason: 'permission' };
  return { ok: true };
}

export async function scheduleReminderNotification(reminder) {
  if (!isDeviceNotificationsEnabled()) return null;
  const api = loadApi();
  if (!api) return null;
  const when = reminder?.when instanceof Date ? reminder.when : null;
  if (!when) return null;
  const seconds = Math.round((when.getTime() - Date.now()) / 1000);
  // Trigger DATE inválido o en el pasado dispara al instante; usar intervalo futuro.
  if (!Number.isFinite(seconds) || seconds < 30) return null;
  const types = api.SchedulableTriggerInputTypes || {};
  const trigger = types.TIME_INTERVAL
    ? {
      type: types.TIME_INTERVAL,
      seconds,
      repeats: false,
    }
    : { seconds, repeats: false };
  if (Platform.OS === 'android') trigger.channelId = REMINDER_CHANNEL;
  return api.scheduleNotificationAsync({
    content: {
      title: reminder.title || 'Recordatorio',
      body: reminder.description || 'Tienes una actividad pendiente',
      sound: true,
      data: { type: reminder.type || 'reminder', id: String(reminder.id || '') },
      ...(Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL } : {}),
    },
    trigger,
  });
}

export async function cancelReminderNotification(notificationId) {
  const api = loadApi();
  if (!api) return;
  const ids = Array.isArray(notificationId) ? notificationId : [notificationId];
  await Promise.all(ids.filter(Boolean).map(async (id) => {
    try {
      await api.cancelScheduledNotificationAsync(String(id));
    } catch {
      // ignore
    }
  }));
}

export function subscribeNotificationResponses(onResponse) {
  if (!canUseNativeNotifications()) return () => {};
  try {
    const api = loadApi();
    if (!api) return () => {};
    const sub = api.addNotificationResponseReceivedListener(onResponse);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
