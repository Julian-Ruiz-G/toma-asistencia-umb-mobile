// ID de clase: código de asignatura (6 dígitos, guion, 3 dígitos) + "_" + grupo. Ej: 123456-123_A1.
// Mismas reglas que el backend (runtime._class_id_for).
const SUBJECT_CODE_RE = /^\d{6}-\d{3}$/;
const GROUP_RE = /^[A-Z0-9]{1,10}$/;
const CLASS_ID_RE = /^\d{6}-\d{3}_[A-Z0-9]{1,10}$/;

export const SUBJECT_CODE_MESSAGE = 'El código de la asignatura debe tener el formato 123456-123 (6 dígitos, guion y 3 dígitos).';
export const GROUP_MESSAGE = 'El grupo solo puede tener letras y números, sin espacios (ej. A1).';

/** Mientras se escribe: solo dígitos y el guion se pone solo después del sexto. */
export function formatSubjectCodeInput(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 9);
  return digits.length > 6 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : digits;
}

export function normalizeGroupInput(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

export function isValidSubjectCode(code) {
  return SUBJECT_CODE_RE.test(String(code || '').trim());
}

export function isValidGroup(group) {
  return GROUP_RE.test(normalizeGroupInput(group));
}

/** ID que tendrá la clase, o '' si el código o el grupo no son válidos. */
export function buildClassId(subjectCode, group) {
  const code = String(subjectCode || '').trim();
  const grp = normalizeGroupInput(group);
  return isValidSubjectCode(code) && GROUP_RE.test(grp) ? `${code}_${grp}` : '';
}

/** Las clases creadas antes de este formato tienen un ID aleatorio. */
export function isFormattedClassId(classId) {
  return CLASS_ID_RE.test(String(classId || ''));
}
