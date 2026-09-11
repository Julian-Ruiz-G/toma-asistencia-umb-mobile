import * as FileSystem from 'expo-file-system/legacy';

const SESSION_FILE = `${FileSystem.documentDirectory || ''}umb-session.json`;

export async function loadPersistedSession() {
  try {
    if (!FileSystem.documentDirectory) return null;
    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(SESSION_FILE);
    const data = JSON.parse(raw);
    if (!data?.authToken || !data?.role) return null;
    return data;
  } catch {
    return null;
  }
}

export async function savePersistedSession(session) {
  if (!FileSystem.documentDirectory) return;
  await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify(session));
}

export async function clearPersistedSession() {
  try {
    if (!FileSystem.documentDirectory) return;
    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (info.exists) {
      await FileSystem.deleteAsync(SESSION_FILE, { idempotent: true });
    }
  } catch {
    // ignore
  }
}

const LOCAL_PROFILES_FILE = `${FileSystem.documentDirectory || ''}umb-local-profiles.json`;

function emailKey(email) {
  return String(email || '').trim().toLowerCase();
}

export async function loadLocalProfile(email) {
  try {
    if (!FileSystem.documentDirectory) return null;
    const info = await FileSystem.getInfoAsync(LOCAL_PROFILES_FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(LOCAL_PROFILES_FILE);
    const data = JSON.parse(raw);
    return data?.[emailKey(email)] || null;
  } catch {
    return null;
  }
}

export async function saveLocalProfile(email, patch) {
  if (!FileSystem.documentDirectory) return;
  const key = emailKey(email);
  if (!key) return;
  let all = {};
  try {
    const info = await FileSystem.getInfoAsync(LOCAL_PROFILES_FILE);
    if (info.exists) {
      all = JSON.parse(await FileSystem.readAsStringAsync(LOCAL_PROFILES_FILE)) || {};
    }
  } catch {
    all = {};
  }
  all[key] = { ...(all[key] || {}), ...(patch || {}) };
  await FileSystem.writeAsStringAsync(LOCAL_PROFILES_FILE, JSON.stringify(all));
}

export async function copyLocalAvatar(email, sourceUri) {
  if (!FileSystem.documentDirectory || !sourceUri) return null;
  const safe = emailKey(email).replace(/[^a-z0-9]/g, '_') || 'user';
  const dest = `${FileSystem.documentDirectory}umb-avatar-${safe}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
