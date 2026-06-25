import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  GraduationCap,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { ADMIN_DELETE_STUDENT_URL, ADMIN_STUDENTS_URL, ADMIN_STUDENTS_BY_CLASS_URL, ADMIN_UPDATE_STUDENT_URL } from '../../config';
import { useAuth } from '../../state/auth';

const mockStudents = [
  { id: '1', firstName: 'Juan', lastName: 'Pérez', code: '20231045892', email: 'juan.perez@umb.edu.co', program: 'Ingeniería', semester: '5', status: 'active', biometricRegistered: true },
  { id: '2', firstName: 'María', lastName: 'López', code: '20231045893', email: 'maria.lopez@umb.edu.co', program: 'Medicina', semester: '3', status: 'active', biometricRegistered: false },
  { id: '3', firstName: 'Carlos', lastName: 'Rodríguez', code: '20231045894', email: 'carlos.rodriguez@umb.edu.co', program: 'Derecho', semester: '2', status: 'suspended', biometricRegistered: false },
  { id: '4', firstName: 'Ana', lastName: 'Martínez', code: '20231045895', email: 'ana.martinez@umb.edu.co', program: 'Ingeniería', semester: '6', status: 'inactive', biometricRegistered: true },
  { id: '5', firstName: 'Laura', lastName: 'Torres', code: '20231045899', email: 'laura.torres@umb.edu.co', program: 'Psicología', semester: '1', status: 'active', biometricRegistered: true },
  { id: '6', firstName: 'Diego', lastName: 'Ramírez', code: '20231045900', email: 'diego.ramirez@umb.edu.co', program: 'Administración', semester: '4', status: 'active', biometricRegistered: false },
];

export default function EstudiantesPage({ navigation }) {
  const { authToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [students, setStudents] = useState([]);
  const [studentsByClass, setStudentsByClass] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editDraft, setEditDraft] = useState({ email: '', fullName: '', studentCode: '' });

  useEffect(() => {
    (async () => {
      try {
        if (!authToken) return;
        if (ADMIN_STUDENTS_URL) {
          const resp = await fetch(ADMIN_STUDENTS_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({}),
          });
          const text = await resp.text();
          let json;
          try { json = JSON.parse(text); } catch { json = null; }
          if (resp.ok) {
            const arr = Array.isArray(json?.students) ? json.students : [];
            const mapped = arr.map((x, idx) => ({
              id: `${String(x?.email || 'row').trim().toLowerCase() || 'row'}-${idx}`,
              firstName: String((x?.fullName || '').split(' ')[0] || ''),
              lastName: String((x?.fullName || '').split(' ').slice(1).join(' ') || ''),
              code: String(x?.studentCode || ''),
              email: String(x?.email || ''),
              program: '—',
              semester: '—',
              status: 'active',
              biometricRegistered: x?.biometricConsent === true,
            }));
            setStudents(mapped);
          }
        }

        if (ADMIN_STUDENTS_BY_CLASS_URL) {
          const resp = await fetch(ADMIN_STUDENTS_BY_CLASS_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({}),
          });
          const text = await resp.text();
          let json;
          try { json = JSON.parse(text); } catch { json = null; }
          if (resp.ok) {
            const arr = Array.isArray(json?.classes) ? json.classes : [];
            setStudentsByClass(arr);
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [authToken]);

  const itemsPerPage = 5;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.code.includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  }, [searchQuery, students]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const statusBadge = (status) => {
    if (status === 'active') return { bg: '#DCFCE7', text: '#15803D', label: 'Activo' };
    if (status === 'inactive') return { bg: '#F3F4F6', text: '#374151', label: 'Inactivo' };
    if (status === 'suspended') return { bg: '#FEE2E2', text: '#B91C1C', label: 'Suspendido' };
    return { bg: '#F3F4F6', text: '#374151', label: status };
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={20} color="#4B5563" />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Estudiantes</Text>
            <Text style={styles.headerSubtitle}>{students.length} registrados</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                setCurrentPage(1);
              }}
              placeholder="Buscar..."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>
          <Pressable onPress={() => setShowModal(true)} style={styles.addBtn}>
            <Plus size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <View style={[styles.statsIcon, { backgroundColor: '#DBEAFE' }]}>
              <GraduationCap size={16} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.statsLabel}>Total</Text>
              <Text style={styles.statsValue}>{students.length}</Text>
            </View>
          </View>
          <View style={styles.statsCard}>
            <View style={[styles.statsIcon, { backgroundColor: '#DCFCE7' }]}>
              <CheckCircle size={16} color="#16A34A" />
            </View>
            <View>
              <Text style={styles.statsLabel}>Activos</Text>
              <Text style={styles.statsValue}>{students.filter((s) => s.status === 'active').length}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 12 }} />

        {paginated.map((s) => {
          const b = statusBadge(s.status);
          return (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.nameText}>{s.firstName} {s.lastName}</Text>
                    <View style={[styles.badge, { backgroundColor: b.bg }]}>
                      <Text style={[styles.badgeText, { color: b.text }]}>{b.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.metaText}>{s.code}</Text>
                  <Text style={styles.metaText}>{s.program}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaSmall}>Sem {s.semester}</Text>
                    <Text style={styles.metaSep}>|</Text>
                    {s.biometricRegistered ? (
                      <View style={styles.bioRow}>
                        <CheckCircle size={12} color="#16A34A" />
                        <Text style={[styles.metaSmall, { color: '#16A34A' }]}>Biometría</Text>
                      </View>
                    ) : (
                      <View style={styles.bioRow}>
                        <XCircle size={12} color="#DC2626" />
                        <Text style={[styles.metaSmall, { color: '#DC2626' }]}>Sin biometría</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.actionsCol}>
                  <Pressable
                    style={styles.iconAction}
                    onPress={() => {
                      setEditDraft({
                        email: String(s.email || ''),
                        fullName: String(`${s.firstName} ${s.lastName}`.trim()),
                        studentCode: String(s.code || ''),
                      });
                      setShowEdit(true);
                    }}
                  >
                    <Edit2 size={16} color="#2563EB" />
                  </Pressable>
                  <Pressable
                    style={styles.iconAction}
                    onPress={() => {
                      Alert.alert(
                        'Confirmar',
                        `¿Eliminar estudiante ${s.email || ''}?`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Eliminar',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                if (!authToken) throw new Error('Sesión inválida');
                                if (!ADMIN_DELETE_STUDENT_URL) throw new Error('API no configurada');
                                const resp = await fetch(ADMIN_DELETE_STUDENT_URL, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${authToken}`,
                                  },
                                  body: JSON.stringify({ email: s.email }),
                                });
                                const text = await resp.text();
                                let json;
                                try { json = JSON.parse(text); } catch { json = null; }
                                if (!resp.ok) {
                                  const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
                                  throw new Error(msg);
                                }
                                setStudents((prev) => prev.filter((x) => x.id !== s.id));
                              } catch (e) {
                                Alert.alert('Error', e?.message || String(e));
                              }
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Trash2 size={16} color="#DC2626" />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}

        <View style={styles.pagination}>
          <Text style={styles.paginationText}>
            {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, filtered.length)} de {filtered.length}
          </Text>
          <View style={styles.paginationBtns}>
            <Pressable
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={[styles.pageBtn, page === 1 ? styles.pageBtnDisabled : null]}
            >
              <ChevronLeft size={16} color="#4B5563" />
            </Pressable>
            <Pressable
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={[styles.pageBtn, page === totalPages ? styles.pageBtnDisabled : null]}
            >
              <ChevronRight size={16} color="#4B5563" />
            </Pressable>
          </View>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo Estudiante</Text>
            <Text style={styles.modalText}>Formulario simplificado (mock)</Text>

            <View style={{ height: 12 }} />
            <Button fullWidth onPress={() => setShowModal(false)}>Guardar</Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="outline" onPress={() => setShowModal(false)}>Cancelar</Button>
          </View>
        </View>
      </Modal>

      <Modal visible={showEdit} transparent animationType="fade" onRequestClose={() => setShowEdit(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Estudiante</Text>
            <Text style={styles.modalText}>{editDraft.email}</Text>

            <View style={{ height: 12 }} />
            <Text style={styles.modalLabel}>Nombre completo</Text>
            <TextInput
              value={editDraft.fullName}
              onChangeText={(t) => setEditDraft((p) => ({ ...p, fullName: t }))}
              placeholder="Ej: Juan Pérez"
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
            />

            <View style={{ height: 10 }} />
            <Text style={styles.modalLabel}>Código estudiante</Text>
            <TextInput
              value={editDraft.studentCode}
              onChangeText={(t) => setEditDraft((p) => ({ ...p, studentCode: t }))}
              placeholder="2023..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              style={styles.modalInput}
            />

            <View style={{ height: 12 }} />
            <Button
              fullWidth
              onPress={async () => {
                try {
                  if (!authToken) throw new Error('Sesión inválida');
                  if (!ADMIN_UPDATE_STUDENT_URL) throw new Error('API no configurada');

                  const payload = {
                    email: String(editDraft.email || '').trim().toLowerCase(),
                    fullName: String(editDraft.fullName || '').trim(),
                    studentCode: String(editDraft.studentCode || '').trim(),
                  };
                  if (!payload.email) throw new Error('Email inválido');

                  const resp = await fetch(ADMIN_UPDATE_STUDENT_URL, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${authToken}`,
                    },
                    body: JSON.stringify(payload),
                  });
                  const text = await resp.text();
                  let json;
                  try { json = JSON.parse(text); } catch { json = null; }
                  if (!resp.ok) {
                    const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
                    throw new Error(msg);
                  }

                  setShowEdit(false);
                  setStudents((prev) => prev.map((s) => {
                    if (String(s.email || '').trim().toLowerCase() !== payload.email) return s;
                    const parts = String(payload.fullName || '').trim().split(' ');
                    const firstName = parts[0] || '';
                    const lastName = parts.slice(1).join(' ');
                    return { ...s, firstName, lastName, code: payload.studentCode || s.code };
                  }));
                } catch (e) {
                  Alert.alert('Error', e?.message || String(e));
                }
              }}
            >
              Guardar
            </Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="outline" onPress={() => setShowEdit(false)}>Cancelar</Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#F3F4F6' },
  headerTitle: { fontWeight: '900', color: '#111827', fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: '#111827' },
  addBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 26 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statsCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  statsIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statsLabel: { color: '#6B7280', fontSize: 12 },
  statsValue: { marginTop: 2, fontWeight: '900', color: '#111827', fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nameText: { fontWeight: '900', color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontWeight: '900', fontSize: 12 },
  metaText: { marginTop: 4, color: '#6B7280' },
  metaRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaSmall: { fontSize: 12, color: '#6B7280' },
  metaSep: { color: '#D1D5DB' },
  bioRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionsCol: { gap: 10 },
  iconAction: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6' },
  pagination: { marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
  paginationText: { color: '#6B7280', fontSize: 12 },
  paginationBtns: { flexDirection: 'row', gap: 10 },
  pageBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled: { opacity: 0.45 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 },
  modalTitle: { fontWeight: '900', color: '#111827', fontSize: 18 },
  modalText: { marginTop: 6, color: '#6B7280' },
  modalLabel: { marginTop: 8, color: '#374151', fontWeight: '900', fontSize: 12 },
  modalInput: { marginTop: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: '#111827' },
});
