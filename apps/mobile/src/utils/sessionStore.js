import * as FileSystem from 'expo-file-system/legacy';

const SESSION_FILE = `${FileSystem.documentDirectory || ''}umb-session.json`;
const TOKEN_KEY = 'umb-auth-token';

// El JWT va en SecureStore (Keychain / Keystore); el resto del perfil, en el archivo.
// Los binarios publicados antes de añadir expo-secure-store no traen el módulo nativo
// y reciben este código por OTA: ahí se sigue usando el archivo como antes.
let secureStoreModule;
function secureStore() {
  if (secureStoreModule !== undefined) return secureStoreModule;
  try {
    // eslint-disable-next-line global-require
    const mod = require('expo-secure-store');
    secureStoreModule = mod && typeof mod.setItemAsync === 'function' ? mod : null;
  } catch {
    secureStoreModule = null;
  }
  return secureStoreModule;
}

async function writeSessionFile(data) {
  await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify(data));
}

async function saveTokenSecurely(token) {
  const store = secureStore();
  if (!store || !token) return false;
  try {
    await store.setItemAsync(TOKEN_KEY, String(token));
    return true;
  } catch {
    return false;
  }
}

export async function loadPersistedSession() {
  try {
    if (!FileSystem.documentDirectory) return null;
    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (!info.exists) return null;
    const data = JSON.parse(await FileSystem.readAsStringAsync(SESSION_FILE));
    if (!data?.role) return null;

    let token = data.authToken || '';
    if (token) {
      // Sesión guardada con la versión anterior: se mueve el token al almacenamiento seguro.
      if (await saveTokenSecurely(token)) {
        const { authToken: _legacy, ...rest } = data;
        await writeSessionFile(rest);
      }
    } else {
      const store = secureStore();
      if (store) {
        try {
          token = (await store.getItemAsync(TOKEN_KEY)) || '';
        } catch {
          token = '';
        }
      }
    }
    if (!token) return null;
    return { ...data, authToken: token };
  } catch {
    return null;
  }
}

export async function savePersistedSession(session) {
  if (!FileSystem.documentDirectory) return;
  const { authToken, ...rest } = session || {};
  const stored = await saveTokenSecurely(authToken);
  await writeSessionFile(stored ? rest : { ...rest, authToken });
}

export async function clearPersistedSession() {
  const store = secureStore();
  if (store) {
    try {
      await store.deleteItemAsync(TOKEN_KEY);
    } catch {
      // ignore
    }
  }
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
  const dest = `${FileSystem.documentDirectory}umb-avatar-${safe}-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
