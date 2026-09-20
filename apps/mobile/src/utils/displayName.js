export function personDisplayName(fullName, fallback = 'Usuario') {
  const name = String(fullName || '').trim();
  if (!name || name.includes('@')) return fallback;
  return name;
}
