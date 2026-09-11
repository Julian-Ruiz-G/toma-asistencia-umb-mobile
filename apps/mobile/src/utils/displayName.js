export function personDisplayName(fullName, fallback = 'Usuario') {
  const name = String(fullName || '').trim();
  return name || fallback;
}
