import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CircleAlert, CircleCheck, Search, UserPlus, X } from 'lucide-react-native';

import { AdminNavButtons, useAdminDrawer } from '../../components/AdminDrawer';
import { MenuButton } from '../../components/RoleDrawer';
import { ADMIN_CLASSES_URL, ADMIN_ENROLL_STUDENT_URL, ADMIN_STUDENTS_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { useColors } from '../../ui/ThemeContext';
import { headerTop } from '../../ui/safeArea';
import { personDisplayName } from '../../utils/displayName';

// Minúsculas y sin tildes: "José" se encuentra escribiendo "jose".
function fold(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

async function postJson(url, authToken, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify(body || {}),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { resp, json };
}

/** Todos los estudiantes con cuenta, para inscribirlos en una clase. Se abre desde el detalle de la clase. */
export default function AgregarEstudiantesPage({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useAdminDrawer(navigation, 'AdminClassAddStudents');
  const { authToken } = useAuth();
  const classId = String(route?.params?.classId || '');
  const className = String(route?.params?.className || 'la clase');

  const [students, setStudents] = useState([]);
  const [enrolled, setEnrolled] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [addingEmail, setAddingEmail] = useState('');
  const [notice, setNotice] = useState(null); // { kind: 'ok' | 'error', text }

  const load = useCallback(async () => {
    if (!authToken || !classId) return;
    setLoading(true);
    setError('');
    try {
      const [studentsRes, classesRes] = await Promise.all([
        postJson(ADMIN_STUDENTS_URL, authToken, {}),
        postJson(ADMIN_CLASSES_URL, authToken, {}),
      ]);
      if (!studentsRes.resp.ok) {
        throw new Error(studentsRes.json?.message || studentsRes.json?.error || `HTTP ${studentsRes.resp.status}`);
      }
      const list = Array.isArray(studentsRes.json?.students) ? studentsRes.json.students : [];
      setStudents([...list].sort((a, b) => fold(a.fullName || a.email).localeCompare(fold(b.fullName || b.email))));
      const cls = (classesRes.json?.classes || []).find((c) => String(c.classId) === classId);
      setEnrolled(new Set((cls?.students || []).map((s) => String(s.email || '').toLowerCase())));
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los estudiantes.');
    } finally {
      setLoading(false);
    }
  }, [authToken, classId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Busca por nombre, correo o CC (código del estudiante). Todas las palabras deben coincidir.
  const visible = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return students;
    return students.filter((s) => {
      const haystack = fold([s.fullName, s.email, s.studentCode].join(' '));
      return words.every((w) => haystack.includes(w));
    });
  }, [query, students]);

  const addStudent = async (s) => {
    const email = String(s.email || '').toLowerCase();
    if (!email || addingEmail) return;
    setAddingEmail(email);
    setNotice(null);
    try {
      const { resp, json } = await postJson(ADMIN_ENROLL_STUDENT_URL, authToken, { classId, studentEmail: email });
      const name = personDisplayName(s.fullName, email);
      if (resp.ok || json?.error === 'AlreadyEnrolled') {
        setEnrolled((prev) => new Set(prev).add(email));
        setNotice({ kind: 'ok', text: resp.ok ? `${name} quedó inscrito en ${className}.` : `${name} ya estaba en ${className}.` });
        return;
      }
      if (json?.error === 'UnknownRoute') {
        throw new Error('El servidor aún no tiene esta función. Hay que desplegar el backend.');
      }
      throw new Error(json?.message || json?.error || `HTTP ${resp.status}`);
    } catch (e) {
      setNotice({ kind: 'error', text: e?.message || 'No se pudo inscribir al estudiante.' });
    } finally {
      setAddingEmail('');
    }
  };

  const renderItem = ({ item: s }) => {
    const email = String(s.email || '').toLowerCase();
    const isIn = enrolled.has(email);
    const busy = addingEmail === email;
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{personDisplayName(s.fullName, email)}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[s.studentCode ? `CC ${s.studentCode}` : '', email].filter(Boolean).join(' · ')}
          </Text>
          {s.hasFace === false ? <Text style={styles.warn}>Sin rostro registrado: no saldrá en la foto de asistencia.</Text> : null}
        </View>
        {isIn ? (
          <View style={styles.inTag}>
            <CircleCheck size={14} color={COLORS.successStrong} />
            <Text style={styles.inTagText}>Inscrito</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => addStudent(s)}
            disabled={!!addingEmail}
            style={[styles.addBtn, addingEmail && !busy ? { opacity: 0.5 } : null]}
            accessibilityRole="button"
            accessibilityLabel={`Agregar a ${personDisplayName(s.fullName, email)}`}
          >
            {busy ? <ActivityIndicator size="small" color={COLORS.white} /> : <UserPlus size={14} color={COLORS.white} />}
            <Text style={styles.addBtnText}>{busy ? 'Agregando' : 'Agregar'}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <AdminNavButtons onBack={goBack} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Agregar estudiantes</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{className}</Text>
        </View>
        <MenuButton onPress={openDrawer} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
      </View>

      <View style={styles.top}>
        <View style={styles.searchWrap}>
          <Search size={16} color={COLORS.placeholder} />
          <TextInput
            value={query}
            onChangeText={(t) => { setQuery(t); setNotice(null); }}
            placeholder="Buscar por nombre, correo o CC"
            placeholderTextColor={COLORS.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda">
              <X size={16} color={COLORS.placeholder} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.count}>
          {loading && !students.length
            ? 'Cargando estudiantes…'
            : `${visible.length} de ${students.length} estudiantes · ${enrolled.size} en la clase`}
        </Text>
        {notice ? (
          <View style={[styles.notice, notice.kind === 'ok' ? styles.noticeOk : styles.noticeError]}>
            {notice.kind === 'ok'
              ? <CircleCheck size={16} color={COLORS.successStrong} />
              : <CircleAlert size={16} color={COLORS.dangerStrong} />}
            <Text style={[styles.noticeText, { color: notice.kind === 'ok' ? COLORS.successStrong : COLORS.dangerStrong }]}>
              {notice.text}
            </Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(s, i) => String(s.email || i)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
            : <Text style={styles.empty}>{query ? 'No hay estudiantes que coincidan.' : 'Todavía no hay estudiantes con cuenta.'}</Text>
        }
      />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.card,
    paddingTop: headerTop(12),
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.surface },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  top: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 0 },
  count: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  noticeOk: { backgroundColor: COLORS.successBg, borderColor: COLORS.successBorder },
  noticeError: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.dangerBorder },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '700' },
  error: { color: COLORS.dangerStrong, fontWeight: '700' },
  list: {
    margin: 16,
    paddingHorizontal: 14,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divider: { height: 1, backgroundColor: COLORS.border },
  name: { fontWeight: '800', color: COLORS.text },
  meta: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  warn: { marginTop: 2, color: COLORS.warningStrong, fontSize: 11, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
  inTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  inTagText: { color: COLORS.successStrong, fontWeight: '800', fontSize: 12 },
  empty: { color: COLORS.muted, textAlign: 'center', paddingVertical: 24, fontWeight: '700' },
});
