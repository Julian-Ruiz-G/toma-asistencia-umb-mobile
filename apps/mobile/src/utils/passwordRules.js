export function passwordIssue(password) {
  const value = String(password || '');
  if (value.length < 8) return 'La contraseña debe tener mínimo 8 caracteres';
  if (!/[A-Z]/.test(value)) return 'La contraseña debe incluir al menos una mayúscula';
  if (!/[a-z]/.test(value)) return 'La contraseña debe incluir al menos una minúscula';
  if (!/\d/.test(value)) return 'La contraseña debe incluir al menos un número';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) return 'La contraseña debe incluir al menos un carácter especial';
  return '';
}

export function homeRouteForRole(role) {
  if (role === 'teacher') return 'TeacherHome';
  if (role === 'admin') return 'AdminDashboard';
  return 'StudentHome';
}
