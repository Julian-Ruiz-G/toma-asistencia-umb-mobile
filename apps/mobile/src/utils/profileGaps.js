import { ADMIN_CONSENTS_URL, ADMIN_REQUEST_PROFILE_URL } from '../config';

function blank(value) {
  const text = String(value || '').trim();
  return !text || text === '—' || text === 'Sin dato';
}

export function studentGaps(person = {}) {
  const gaps = [];
  if (blank(person.fullName) && blank(`${person.firstName || ''} ${person.lastName || ''}`)) {
    gaps.push({ id: 'name', label: 'nombre completo' });
  }
  if (blank(person.program)) gaps.push({ id: 'program', label: 'carrera' });
  if (blank(person.semester)) gaps.push({ id: 'semester', label: 'semestre en curso' });
  if (blank(person.phone)) gaps.push({ id: 'phone', label: 'teléfono' });
  if (!person.acceptTerms) gaps.push({ id: 'terms', label: 'términos y condiciones' });
  if (!person.acceptPrivacy) gaps.push({ id: 'privacy', label: 'política de privacidad' });
  if (!person.biometricConsent && !person.hasFace && !person.biometricRegistered) {
    gaps.push({ id: 'biometric', label: 'consentimiento biométrico' });
  }
  return gaps;
}

export function teacherGaps(person = {}) {
  const gaps = [];
  if (blank(person.fullName) && blank(`${person.firstName || ''} ${person.lastName || ''}`)) {
    gaps.push({ id: 'name', label: 'nombre completo' });
  }
  if (person.acceptTerms !== true) gaps.push({ id: 'terms', label: 'términos y condiciones' });
  if (person.acceptPrivacy !== true) gaps.push({ id: 'privacy', label: 'política de privacidad' });
  return gaps;
}

export function gapsLabel(gaps) {
  return (gaps || []).map((g) => g.label).join(', ');
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function errorText(json, text, status) {
  return (json && (json.error || json.message)) || text || `HTTP ${status}`;
}

function needsDeploy(err) {
  const text = String(err || '');
  return text.includes('imageBase64') || text === 'UnknownRoute' || /HTTP 404/.test(text);
}

async function postRequest(url, authToken, body) {
  if (!url) return { ok: false, err: 'API no configurada', json: null, status: 0 };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  const json = parseJson(text);
  if (!resp.ok) {
    return { ok: false, err: errorText(json, text, resp.status), json, status: resp.status };
  }
  return { ok: true, json, status: resp.status };
}

function requestSucceeded(json) {
  return Boolean(json?.notification) || (json?.ok === true && Array.isArray(json?.missing));
}

export async function requestProfileCompletion(authToken, { email, role = 'student', consentsOnly = false } = {}) {
  if (!authToken) throw new Error('Sesión inválida');
  // consentsOnly: pide solo términos, privacidad y biometría, no los datos del perfil.
  const payload = { email, role, ...(consentsOnly ? { consentsOnly: true } : {}) };

  const first = await postRequest(ADMIN_REQUEST_PROFILE_URL, authToken, payload);
  if (first.ok && requestSucceeded(first.json)) return first.json;
  if (first.ok) return first.json;

  if (String(first.err) === 'NothingToRequest') {
    throw new Error('Este usuario ya tiene los datos y consentimientos al día.');
  }

  if (needsDeploy(first.err) || first.status === 404) {
    const second = await postRequest(ADMIN_CONSENTS_URL, authToken, {
      ...payload,
      action: 'request-profile',
    });
    if (second.ok && requestSucceeded(second.json)) return second.json;
    throw new Error('El servidor aún no tiene esta función. Hay que desplegar la Lambda.');
  }

  throw new Error(first.err);
}

/**
 * Pide los consentimientos pendientes (términos, privacidad y, en estudiantes, biometría)
 * a todos los usuarios del rol: 'student', 'teacher' o 'all'. Cada uno recibe una notificación.
 */
export async function requestAllConsents(authToken, role = 'all') {
  if (!authToken) throw new Error('Sesión inválida');
  const res = await postRequest(ADMIN_CONSENTS_URL, authToken, { action: 'request-all', role });
  if (!res.ok) {
    if (needsDeploy(res.err) || res.status === 404) {
      throw new Error('El servidor aún no tiene esta función. Hay que desplegar la Lambda.');
    }
    throw new Error(res.json?.message || res.err);
  }
  if (typeof res.json?.total !== 'number') {
    // La Lambda anterior ignora la acción y devuelve la lista: no se envió nada.
    throw new Error('El servidor aún no tiene esta función. Hay que desplegar la Lambda.');
  }
  return res.json;
}

export function requestAllSummary(result) {
  const students = Number(result?.studentsNotified || 0);
  const teachers = Number(result?.teachersNotified || 0);
  if (!students && !teachers) return 'Todos tienen los consentimientos al día. No se envió ninguna solicitud.';
  const parts = [];
  if (students) parts.push(`${students} ${students === 1 ? 'estudiante' : 'estudiantes'}`);
  if (teachers) parts.push(`${teachers} ${teachers === 1 ? 'docente' : 'docentes'}`);
  return `Se envió la solicitud a ${parts.join(' y ')}. La verán en sus notificaciones.`;
}
