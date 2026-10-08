/**
 * Reglas puras de los avisos. Sin React, para poder probar cada alerta.
 */

function inferKind(title) {
  const t = String(title || '').toLowerCase();
  if (
    t.includes('error') ||
    t.includes('no se pudo') ||
    t.includes('inválid') ||
    t.includes('invalida') ||
    t.includes('denegad') ||
    t.includes('falló') ||
    t.includes('fallo')
  ) {
    return 'error';
  }
  if (
    t.includes('listo') ||
    t.includes('cread') ||
    t.includes('actualiz') ||
    t.includes('eliminad') ||
    t.includes('guardad') ||
    t.includes('finaliz') ||
    t.includes('cuenta creada')
  ) {
    return 'success';
  }
  if (
    t.includes('permiso') ||
    t.includes('falta') ||
    t.includes('elige') ||
    t.includes('pendiente') ||
    t.includes('incompleto') ||
    t.includes('obligator') ||
    t.includes('sin ')
  ) {
    return 'warning';
  }
  if (t.includes('eliminar') || t.includes('confirmar')) return 'confirm';
  return 'info';
}

function kickerFor(kind, explicit) {
  if (explicit) return explicit;
  if (kind === 'error') return 'Error';
  if (kind === 'success') return 'Listo';
  if (kind === 'warning') return 'Aviso';
  if (kind === 'confirm') return 'Confirmar';
  if (kind === 'offday' || kind === 'early' || kind === 'late') return 'Aviso de horario';
  return 'Aviso';
}

function splitBody(message) {
  const raw = String(message || '').trim();
  if (!raw) return { subtitle: '', points: [] };
  const parts = raw
    .split(/\n+/)
    .map((s) => s.replace(/^[•\-\u2022]\s*/, '').trim())
    .filter(Boolean);
  if (parts.length <= 1) return { subtitle: raw, points: [] };
  return { subtitle: parts[0], points: parts.slice(1) };
}

/**
 * Arma el aviso que se muestra. Devuelve null si el ajuste de avisos lo oculta.
 * Errores y confirmaciones siempre se muestran.
 */
function prepareAppAlert(title, message, buttons, options) {
  const notificationsEnabled = !options || options.notificationsEnabled !== false;
  const list = Array.isArray(buttons) ? buttons.filter(Boolean) : [];
  const cancel = list.find((b) => b.style === 'cancel');
  const destructive = list.find((b) => b.style === 'destructive');
  const rest = list.filter((b) => b !== cancel);
  const primary = destructive || rest[rest.length - 1] || { text: 'Entendido' };
  const secondary = cancel || (rest.length > 1 && rest[0] !== primary ? rest[0] : null);
  const kind = destructive || (cancel && rest.length) ? 'confirm' : inferKind(title);
  if (!notificationsEnabled && kind !== 'error' && kind !== 'confirm') return null;
  const body = splitBody(message);
  return {
    kind,
    kicker: kickerFor(kind),
    title: String(title || 'Aviso'),
    subtitle: body.subtitle,
    points: body.points,
    primaryLabel: primary.text || 'Entendido',
    secondaryLabel: secondary ? secondary.text : undefined,
    destructive: primary.style === 'destructive' || kind === 'error',
    onPrimary: primary.onPress,
    onSecondary: secondary ? secondary.onPress : undefined,
  };
}

function presentNotice(notice) {
  const kind = notice?.kind || 'info';
  const points = Array.isArray(notice?.points) ? notice.points.filter(Boolean) : [];
  return {
    kind,
    kicker: kickerFor(kind, notice?.kicker),
    title: String(notice?.title || 'Aviso'),
    subtitle: String(notice?.subtitle || '').trim(),
    points,
    primaryLabel: notice?.primaryLabel || 'Entendido',
    secondaryLabel: notice?.secondaryLabel || undefined,
    destructive: !!notice?.destructive,
    onPrimary: notice?.onPrimary,
    onSecondary: notice?.onSecondary,
  };
}

module.exports = {
  inferKind,
  kickerFor,
  splitBody,
  prepareAppAlert,
  presentNotice,
};
