import { Platform } from 'react-native';
import { COLORS } from '../ui/theme';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { isDeviceNotificationsEnabled } from './appSettings';
import { loadReminders, reminderOccurrences, saveReminders } from './remindersStore';

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
    let dismissAllNotificationsAsync = async () => {};
    try {
      dismissAllNotificationsAsync = require('expo-notifications/build/dismissAllNotificationsAsync').dismissAllNotificationsAsync
        || dismissAllNotificationsAsync;
    } catch {
      // ignore
    }
    let setBadgeCountAsync = async () => false;
    try {
      setBadgeCountAsync = require('expo-notifications/build/setBadgeCountAsync').setBadgeCountAsync
        || setBadgeCountAsync;
    } catch {
      // ignore
    }
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
      dismissAllNotificationsAsync,
      setBadgeCountAsync,
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

// Solo se muestran avisos con una sesión abierta (ver setNotificationSession).
let sessionActive = false;

export function setNotificationSession(active) {
  sessionActive = !!active;
  if (!sessionActive) seenServerIds = null;
}

function handlerOptions() {
  const enabled = isDeviceNotificationsEnabled() && sessionActive;
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
  if (!isDeviceNotificationsEnabled() || !sessionActive) return null;
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

/**
 * Al cerrar sesión: cancela lo programado (recordatorios, "clase por comenzar", alertas del
 * docente), quita las notificaciones de la bandeja y el contador del ícono. Lo programado lo
 * dispara el sistema aunque la app esté cerrada, por eso hay que cancelarlo aquí.
 */
export async function clearAllNotifications() {
  setNotificationSession(false);
  const api = loadApi();
  if (!api) return;
  await cancelAllScheduledNotifications();
  try {
    await api.dismissAllNotificationsAsync();
  } catch {
    // ignore
  }
  try {
    await api.setBadgeCountAsync(0);
  } catch {
    // ignore
  }
}

/** Vuelve a programar los recordatorios guardados de la cuenta (tras iniciar sesión o activar avisos). */
export async function rescheduleReminders(email) {
  if (!email) return;
  const list = await loadReminders(email);
  const updated = [];
  for (const item of list) {
    await cancelReminderNotification(item.notificationIds || item.notificationId);
    const ids = [];
    for (const occ of reminderOccurrences(item)) {
      const nid = await scheduleReminderNotification({
        id: item.id,
        title: item.title,
        description: item.description,
        when: occ.when,
      });
      if (nid) ids.push(nid);
    }
    updated.push({ ...item, notificationIds: ids, notificationId: ids[0] || null });
  }
  await saveReminders(email, updated);
}

// Ids de notificaciones del servidor ya vistas en esta sesión (null = aún no se cargó la primera lista).
let seenServerIds = null;

/**
 * Hace sonar en el teléfono las notificaciones nuevas del servidor (asistencia registrada,
 * justificación revisada...). La primera lista de la sesión solo se marca como vista.
 * Se puede llamar desde varias pantallas: cada id suena una sola vez.
 */
export async function announceServerNotifications(list) {
  const items = Array.isArray(list) ? list : [];
  if (seenServerIds === null) {
    seenServerIds = new Set(items.map((n) => String(n?.id || '')));
    return;
  }
  const fresh = items.filter((n) => n?.id && !n.read && !seenServerIds.has(String(n.id)));
  fresh.forEach((n) => seenServerIds.add(String(n.id)));
  if (!fresh.length || !sessionActive || !isDeviceNotificationsEnabled()) return;
  const api = loadApi();
  if (!api) return;
  for (const n of fresh.slice(0, 3)) {
    try {
      await api.scheduleNotificationAsync({
        content: {
          title: n.title || 'Notificación',
          body: n.message || '',
          sound: true,
          data: { type: 'server', id: String(n.id) },
          ...(Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL } : {}),
        },
        trigger: null,
      });
    } catch {
      // ignore
    }
  }
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
