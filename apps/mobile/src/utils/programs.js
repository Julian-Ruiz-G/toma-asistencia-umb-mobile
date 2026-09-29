// Carreras de la UMB por facultad. `semesters` es la duración máxima (Ing. Ambiental: 8 a 10).
export const FACULTIES = [
  {
    name: 'Facultad de Salud',
    programs: [
      { name: 'Enfermería', semesters: 9, snies: '51583' },
      { name: 'Fisioterapia', semesters: 9, snies: '21365' },
      { name: 'Fonoaudiología', semesters: 9, snies: '21371' },
      { name: 'Terapia Ocupacional', semesters: 9, snies: '21372' },
      { name: 'Terapia Respiratoria', semesters: 8, snies: '111607' },
    ],
  },
  {
    name: 'Facultad de Ingeniería',
    programs: [
      { name: 'Ingeniería de Software', semesters: 8, snies: '103897' },
      { name: 'Ingeniería Biomédica', semesters: 8, snies: '21390' },
      { name: 'Ingeniería Mecatrónica', semesters: 8, snies: '109664' },
      { name: 'Ingeniería Industrial', semesters: 8, snies: '21366' },
      { name: 'Ingeniería Ambiental', semesters: 10, semestersLabel: '8 a 10 semestres', snies: '21389' },
    ],
  },
  {
    name: 'Facultad de Psicología, Educación, Ciencias Humanas y Sociales',
    programs: [
      { name: 'Psicología', semesters: 10, snies: '21368' },
      { name: 'Profesional en Ciencias del Deporte', semesters: 8, snies: '106870' },
    ],
  },
  {
    name: 'Facultad de Derecho',
    programs: [
      { name: 'Derecho', semesters: 8, snies: '21405' },
      { name: 'Tecnología en Investigación Criminal', semesters: 6, snies: '52592' },
    ],
  },
  {
    name: 'Facultad de Artes',
    programs: [
      { name: 'Dirección y Producción de Cine y Televisión', semesters: 8, snies: '21399' },
    ],
  },
];

export const PROGRAMS = FACULTIES.flatMap((f) => f.programs.map((p) => ({ ...p, faculty: f.name })));

function fold(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Carrera del listado que corresponde al texto guardado (ignora tildes y mayúsculas), o null. */
export function findProgram(name) {
  const key = fold(name);
  if (!key) return null;
  return PROGRAMS.find((p) => fold(p.name) === key) || null;
}

export function sameProgram(a, b) {
  const ka = fold(a);
  const kb = fold(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const pa = findProgram(a);
  const pb = findProgram(b);
  return !!(pa && pb && fold(pa.name) === fold(pb.name));
}

/** Una clase puede tener estudiantes de varias carreras: coincide si al menos uno es de esa carrera. */
export function classTouchesProgram(cls, programName) {
  if (!programName) return true;
  const students = cls?.students || [];
  if (students.some((s) => sameProgram(s.program, programName))) return true;
  const programs = cls?.programs || [];
  return programs.some((p) => sameProgram(p.label || p.program, programName));
}

export function classProgramLabels(cls) {
  const fromList = (cls?.programs || [])
    .map((p) => String(p.label || p.program || '').trim())
    .filter(Boolean);
  if (fromList.length) return [...new Set(fromList)];
  const fromStudents = [...new Set(
    (cls?.students || []).map((s) => String(s.program || '').trim()).filter(Boolean)
  )];
  return fromStudents;
}

export function semestersLabel(program) {
  return program?.semestersLabel || `${program?.semesters} semestres`;
}
