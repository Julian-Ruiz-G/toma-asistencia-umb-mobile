import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';

import { personDisplayName } from '../utils/displayName';
import { prettyLabel } from '../utils/adminDashboard';
import { sameProgram } from '../utils/programs';

export function semesterTitle(raw) {
  const num = String(raw || '').match(/\d+/)?.[0];
  if (num) return `Semestre ${num}`;
  return prettyLabel(raw, 'Sin semestre');
}

export function sameSemester(a, b) {
  const na = String(a || '').match(/\d+/)?.[0] || '';
  const nb = String(b || '').match(/\d+/)?.[0] || '';
  if (na && nb) return na === nb;
  const ka = String(a || '').trim().toLowerCase();
  const kb = String(b || '').trim().toLowerCase();
  return !!(ka && kb && ka === kb);
}

function studentEmails(people) {
  return new Set((people || []).map((s) => String(s.email || '').toLowerCase()).filter(Boolean));
}

function classKey(c) {
  return String(c?.classId || `${c?.className || ''}|${c?.group || ''}|${c?.teacherEmail || ''}`);
}

/** Clase y docente se vinculan a una carrera/semestre por los estudiantes que asisten. */
function classesThroughStudents(people, classes, teachers, attendance) {
  const emails = studentEmails(people);
  const byKey = new Map();
  const add = (c) => {
    if (!c) return;
    const key = classKey(c);
    if (!key || byKey.has(key)) return;
    byKey.set(key, c);
  };

  for (const c of classes || []) {
    const roster = c.students || [];
    if (roster.some((st) => emails.has(String(st.email || '').toLowerCase()))) add(c);
  }

  const classNames = new Set();
  for (const r of attendance || []) {
    const email = String(r.studentEmail || '').toLowerCase();
    if (emails.has(email) && r.className) classNames.add(String(r.className));
  }
  for (const c of classes || []) {
    if (classNames.has(String(c.className || ''))) add(c);
  }
  for (const t of teachers || []) {
    for (const c of t.classes || []) {
      if (!classNames.has(String(c.className || ''))) continue;
      add({
        ...c,
        teacherEmail: t.email,
        teacherName: t.fullName,
      });
    }
  }
  return [...byKey.values()];
}

function teachersThroughClasses(relatedClasses, teachers) {
  const emails = new Set(
    (relatedClasses || []).map((c) => String(c.teacherEmail || '').toLowerCase()).filter(Boolean)
  );
  return (teachers || []).filter((t) => emails.has(String(t.email || '').toLowerCase()));
}

function emailsOf(people) {
  return [...new Set((people || []).map((p) => String(p.email || '').trim().toLowerCase()).filter(Boolean))];
}

export function buildInsightDrill({ drill, students, teachers, classes, sessions, attendance }) {
  if (!drill) return null;

  if (drill.type === 'program') {
    const people = (students || []).filter((s) => sameProgram(s.program, drill.label));
    const relatedClasses = classesThroughStudents(people, classes, teachers, attendance);
    const relatedTeachers = teachersThroughClasses(relatedClasses, teachers);
    return {
      title: drill.label,
      subtitle: 'Vinculado por los estudiantes de esta carrera',
      kpis: [
        { label: 'Estudiantes', value: people.length },
        { label: 'Clases', value: relatedClasses.length },
        { label: 'Docentes', value: relatedTeachers.length },
      ],
      note: 'Si un estudiante de esta carrera ve una materia con un docente, esa clase y ese docente quedan vinculados aquí. Una clase puede tener varias carreras.',
      sections: [
        {
          title: 'Clases',
          empty: 'Aún no hay clases con estudiantes de esta carrera.',
          rows: relatedClasses.map(classRow),
          action: { label: 'Ver clases de esta carrera', screen: 'AdminClasses', params: { program: drill.label } },
        },
        {
          title: 'Docentes',
          empty: 'Aún no hay docentes vinculados por esos estudiantes.',
          rows: relatedTeachers.map(teacherRow),
          action: { label: 'Ver docentes de esta carrera', screen: 'AdminTeachers', params: { emails: emailsOf(relatedTeachers), program: drill.label } },
        },
        {
          title: 'Estudiantes',
          empty: 'No hay estudiantes en esta carrera.',
          rows: people.slice(0, 50).map(studentRow),
          action: { label: 'Ver estudiantes de esta carrera', screen: 'AdminStudents', params: { program: drill.label } },
        },
      ],
    };
  }

  if (drill.type === 'semester') {
    const people = (students || []).filter((s) => sameSemester(s.semester, drill.label));
    const relatedClasses = classesThroughStudents(people, classes, teachers, attendance);
    const relatedTeachers = teachersThroughClasses(relatedClasses, teachers);
    return {
      title: drill.label,
      subtitle: 'Vinculado por los estudiantes de este semestre',
      kpis: [
        { label: 'Estudiantes', value: people.length },
        { label: 'Clases', value: relatedClasses.length },
        { label: 'Docentes', value: relatedTeachers.length },
      ],
      note: 'Las clases se asocian porque hay estudiantes de este semestre inscritos o con asistencia en ellas. Pueden mezclar varios semestres.',
      sections: [
        {
          title: 'Clases',
          empty: 'Aún no hay clases con estudiantes de este semestre.',
          rows: relatedClasses.map(classRow),
          action: { label: 'Ver clases de este semestre', screen: 'AdminClasses', params: { semester: drill.label } },
        },
        {
          title: 'Docentes',
          empty: 'Aún no hay docentes vinculados por esos estudiantes.',
          rows: relatedTeachers.map(teacherRow),
          action: { label: 'Ver docentes de este semestre', screen: 'AdminTeachers', params: { emails: emailsOf(relatedTeachers), semester: drill.label } },
        },
        {
          title: 'Estudiantes',
          empty: 'No hay estudiantes en este semestre.',
          rows: people.slice(0, 50).map(studentRow),
          action: { label: 'Ver estudiantes de este semestre', screen: 'AdminStudents', params: { semester: drill.label } },
        },
      ],
    };
  }

  if (drill.type === 'teacher') {
    const teacher = (teachers || []).find((t) => String(t.email || '').toLowerCase() === String(drill.email || '').toLowerCase())
      || (teachers || []).find((t) => personDisplayName(t.fullName, t.email) === drill.label);
    const owned = teacher?.classes || [];
    const ownedKeys = new Set(owned.map(classKey));
    const fromList = (classes || []).filter((c) => (
      String(c.teacherEmail || '').toLowerCase() === String(teacher?.email || '').toLowerCase()
      || ownedKeys.has(classKey(c))
    ));
    const classRows = (fromList.length ? fromList : owned).map(classRow);
    const roster = fromList.flatMap((c) => c.students || []);
    const people = (students || []).filter((s) => roster.some((st) => String(st.email || '').toLowerCase() === String(s.email || '').toLowerCase()));
    return {
      title: personDisplayName(teacher?.fullName, teacher?.email || drill.label || 'Docente'),
      subtitle: teacher?.email || 'Clases asignadas',
      kpis: [
        { label: 'Clases', value: classRows.length || Number(teacher?.subjectsCount) || 0 },
        { label: 'Estudiantes', value: people.length || roster.length },
      ],
      note: 'Las carreras aparecen porque los estudiantes de esas clases pertenecen a ellas.',
      sections: [
        {
          title: 'Clases asignadas',
          empty: 'Este docente no tiene clases asignadas.',
          rows: classRows,
          action: { label: 'Ver clases de este docente', screen: 'AdminClasses', params: { teacherEmail: teacher?.email || '' } },
        },
        {
          title: 'Estudiantes en sus clases',
          empty: 'No hay lista de estudiantes para estas clases.',
          rows: (people.length ? people : roster).slice(0, 50).map(studentRow),
          action: { label: 'Ver estudiantes de este docente', screen: 'AdminStudents', params: { emails: emailsOf(people.length ? people : roster) } },
        },
      ],
      extraAction: { label: 'Ir a gestión de docentes', screen: 'AdminTeachers', params: { query: teacher?.email || drill.label || '' } },
    };
  }

  if (drill.type === 'load') {
    const withClasses = drill.key === 'with';
    const withoutClasses = drill.key === 'without';
    const list = (teachers || []).filter((t) => {
      if (withClasses) return t.subjectsCount > 0;
      if (withoutClasses) return t.subjectsCount <= 0;
      return true;
    });
    return {
      title: withClasses ? 'Docentes con clases' : withoutClasses ? 'Docentes sin clases' : 'Todos los docentes',
      subtitle: withClasses ? 'Tienen al menos una asignatura asignada' : withoutClasses ? 'Aún no tienen carga académica' : 'Cuerpo docente',
      kpis: [{ label: 'Docentes', value: list.length }],
      sections: [{
        title: 'Listado',
        empty: 'No hay docentes en este grupo.',
        rows: list.map(teacherRow),
        action: { label: 'Ir a gestión de docentes', screen: 'AdminTeachers', params: {} },
      }],
    };
  }

  if (drill.type === 'photo') {
    const list = sessions || [];
    if (drill.key === 'noPhoto') {
      const rows = list.filter((s) => !s.hasPhoto);
      return {
        title: 'Sesiones aún sin foto',
        subtitle: 'Hoy abrieron asistencia, pero falta la foto del salón',
        kpis: [{ label: 'Sesiones', value: rows.length }],
        note: 'Sin la foto de reconocimiento no se confirma quién estuvo en clase. Esta lista es solo de hoy.',
        sections: [{
          title: 'Sesiones de hoy',
          empty: 'Todas las sesiones de hoy ya tienen foto.',
          rows: rows.map(sessionRow),
          action: { label: 'Ir a gestión de clases', screen: 'AdminClasses', params: {} },
        }],
      };
    }
    if (drill.key === 'unrecognized') {
      const rows = list.filter((s) => s.hasPhoto && Number(s.unrecognized) > 0);
      return {
        title: 'Rostros sin identificar',
        subtitle: 'Personas detectadas hoy que no coincidieron con un estudiante inscrito',
        kpis: [
          { label: 'Sesiones', value: rows.length },
          { label: 'Sin identificar', value: rows.reduce((n, s) => n + (Number(s.unrecognized) || 0), 0) },
        ],
        note: 'La cifra suma todos los rostros sin identificar de las fotos de hoy. No es el número de sesiones.',
        sections: [{
          title: 'Sesiones de hoy',
          empty: 'No hay rostros sin identificar hoy.',
          rows: rows.map(sessionRow),
          action: { label: 'Ir a gestión de clases', screen: 'AdminClasses', params: {} },
        }],
      };
    }
    const rows = list.filter((s) => s.hasPhoto && Number(s.recognized) > 0);
    const recognized = rows.reduce((n, s) => n + (Number(s.recognized) || 0), 0);
    return {
      title: 'Estudiantes reconocidos',
      subtitle: 'Suma de coincidencias en las fotos de clase de hoy',
      kpis: [
        { label: 'Sesiones', value: rows.length },
        { label: 'Reconocidos', value: recognized },
      ],
      note: 'Si una clase reconoció 4 estudiantes y otra 2, aquí verás 6. Es la suma de hoy, no de la semana.',
      sections: [{
        title: 'Sesiones de hoy',
        empty: 'Aún no hay estudiantes reconocidos hoy.',
        rows: rows.map(sessionRow),
        action: { label: 'Ir a gestión de clases', screen: 'AdminClasses', params: {} },
      }],
    };
  }

  if (drill.type === 'session') {
    const s = drill.session || {};
    return {
      title: s.className || 'Sesión de asistencia',
      subtitle: [s.group ? `Grupo ${s.group}` : null, s.teacherEmail].filter(Boolean).join(' · ') || 'Sesión de hoy',
      kpis: s.hasPhoto
        ? [
          { label: 'Detectados', value: s.facesDetected || 0 },
          { label: 'Reconocidos', value: s.recognized || 0 },
          { label: 'Sin identificar', value: s.unrecognized || 0 },
        ]
        : [{ label: 'Foto', value: 'Pendiente' }],
      note: s.hasPhoto
        ? 'Detectados: rostros que vio la cámara. Reconocidos: coincidieron con un estudiante inscrito. Sin identificar: no coincidieron (visitante, otro grupo o sin foto de perfil).'
        : 'El docente abrió la sesión, pero todavía no toma la foto de reconocimiento. Sin esa foto no se confirma quién estuvo en el salón.',
      extraAction: { label: 'Ver esta clase', screen: 'AdminClasses', params: { query: s.className || '' } },
      sections: [],
    };
  }

  return null;
}

function classRow(c) {
  const programs = [...new Set(
    (c.programs || []).map((p) => p.label).filter(Boolean)
      .concat((c.students || []).map((s) => s.program).filter(Boolean))
  )];
  const mixed = programs.length > 1;
  return {
    title: `${c.className || 'Clase'}${c.group ? ` · ${c.group}` : ''}`,
    meta: [
      personDisplayName(c.teacherName, c.teacherEmail || 'Sin docente'),
      mixed ? `${programs.length} carreras` : (programs[0] || null),
      c.studentsCount != null ? `${c.studentsCount} estudiantes` : null,
    ].filter(Boolean).join(' · '),
  };
}

function teacherRow(t) {
  return {
    title: personDisplayName(t.fullName, t.email || 'Docente'),
    meta: [t.email, `${t.subjectsCount || (t.classes || []).length} clases`].filter(Boolean).join(' · '),
  };
}

function studentRow(s) {
  const name = s.fullName || s.name;
  return {
    title: personDisplayName(name, s.email || 'Estudiante'),
    meta: [prettyLabel(s.program, ''), s.semester ? semesterTitle(s.semester) : null, s.email].filter(Boolean).join(' · '),
  };
}

function sessionRow(s) {
  return {
    title: `${s.className || 'Clase'}${s.group ? ` · ${s.group}` : ''}`,
    meta: s.hasPhoto
      ? `${s.recognized || 0} reconocidos · ${s.unrecognized || 0} sin identificar · ${s.facesDetected || 0} detectados`
      : 'Falta la foto de reconocimiento',
  };
}

export function DrillModal({ visible, model, colors, onClose, onNavigate }) {
  const insets = useSafeAreaInsets();
  if (!model) return null;
  const go = (action) => {
    if (!action?.screen) return;
    onClose?.();
    onNavigate?.(action.screen, action.params || {});
  };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: 12 + insets.top, paddingBottom: 12 + insets.bottom }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.head}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.title, { color: colors.text }]}>{model.title}</Text>
              {model.subtitle ? <Text style={[styles.sub, { color: colors.muted }]}>{model.subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]} accessibilityLabel="Cerrar">
              <X size={18} color={colors.icon} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {model.kpis?.length ? (
              <View style={styles.kpiRow}>
                {model.kpis.map((k) => (
                  <View key={k.label} style={[styles.kpi, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.kpiValue, { color: colors.text }]}>{k.value}</Text>
                    <Text style={[styles.kpiLabel, { color: colors.muted }]}>{k.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {model.note ? <Text style={[styles.note, { color: colors.textSecondary }]}>{model.note}</Text> : null}

            {(model.sections || []).map((section) => (
              <View key={section.title} style={[styles.block, { borderColor: colors.border }]}>
                <Text style={[styles.section, { color: colors.textSecondary }]}>{section.title}</Text>
                {(section.rows || []).length === 0 ? (
                  <Text style={[styles.empty, { color: colors.muted }]}>{section.empty}</Text>
                ) : (
                  section.rows.map((row, i) => (
                    <View
                      key={`${section.title}-${row.title}-${i}`}
                      style={[styles.row, i ? { borderTopColor: colors.border, borderTopWidth: 1 } : null]}
                    >
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{row.title}</Text>
                      {row.meta ? <Text style={[styles.rowMeta, { color: colors.muted }]}>{row.meta}</Text> : null}
                    </View>
                  ))
                )}
                {section.action ? (
                  <Pressable onPress={() => go(section.action)} style={[styles.action, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.actionText, { color: colors.primary }]}>{section.action.label}</Text>
                    <ChevronRight size={16} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            ))}

            {model.extraAction ? (
              <Pressable onPress={() => go(model.extraAction)} style={[styles.action, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.actionText, { color: colors.primary }]}>{model.extraAction.label}</Text>
                <ChevronRight size={16} color={colors.primary} />
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 20,
    maxHeight: '86%',
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontWeight: '900', fontSize: 17 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scroll: { maxHeight: 520 },
  scrollBody: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  kpiValue: { fontWeight: '900', fontSize: 16 },
  kpiLabel: { marginTop: 3, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  note: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  block: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  section: { fontWeight: '900', fontSize: 12, marginBottom: 4 },
  empty: { fontSize: 12, fontWeight: '700', paddingVertical: 8 },
  row: { paddingVertical: 9 },
  rowTitle: { fontWeight: '800', fontSize: 14 },
  rowMeta: { marginTop: 2, fontSize: 12, fontWeight: '700' },
  action: { marginTop: 8, marginBottom: 6, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionText: { fontWeight: '800' },
});
