export function missingStudentProfileFields({ fullName, program, semester, phone } = {}) {
  const missing = [];
  if (!String(fullName || '').trim()) missing.push('nombre completo');
  if (!String(program || '').trim()) missing.push('carrera / programa');
  if (!String(semester || '').trim()) missing.push('semestre');
  if (!String(phone || '').trim()) missing.push('teléfono');
  return missing;
}

export function isStudentProfileComplete(profile) {
  return missingStudentProfileFields(profile).length === 0;
}

export function studentProfileIncompleteMessage(profile) {
  const missing = missingStudentProfileFields(profile);
  if (!missing.length) return '';
  return `Para continuar debes completar tu perfil: ${missing.join(', ')}.`;
}
