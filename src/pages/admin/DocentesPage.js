import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Plus,
  Search,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { ADMIN_CREATE_TEACHER_URL, ADMIN_DELETE_TEACHER_URL, ADMIN_TEACHERS_URL, ADMIN_UPDATE_TEACHER_URL } from '../../config';
import { useAuth } from '../../state/auth';

const mockTeachers = [
  { id: '1', code: 'DOC001', firstName: 'Dr. Roberto', lastName: 'Martínez Vega', email: 'roberto.martinez@umb.edu.co', department: 'Ingeniería', specialization: 'Sistemas', status: 'active', subjectsCount: 4, biometricRegistered: true, lastAccess: '2024-01-15' },
  { id: '2', code: 'DOC002', firstName: 'Dra. Carmen', lastName: 'López Ruiz', email: 'carmen.lopez@umb.edu.co', department: 'Enfermería', specialization: 'Cuidados Intensivos', status: 'active', subjectsCount: 3, biometricRegistered: true, lastAccess: '2024-01-14' },
  { id: '3', code: 'DOC003', firstName: 'Dr. Alejandro', lastName: 'González Silva', email: 'alejandro.gonzalez@umb.edu.co', department: 'Derecho', specialization: 'Constitucional', status: 'on_leave', subjectsCount: 2, biometricRegistered: false, lastAccess: '2024-01-10' },
  { id: '4', code: 'DOC004', firstName: 'Dra. Patricia', lastName: 'Hernández Díaz', email: 'patricia.hernandez@umb.edu.co', department: 'Psicología', specialization: 'Clínica', status: 'active', subjectsCount: 5, biometricRegistered: true, lastAccess: '2024-01-15' },
  { id: '5', code: 'DOC005', firstName: 'Dr. Fernando', lastName: 'Sánchez Castro', email: 'fernando.sanchez@umb.edu.co', department: 'Administración', specialization: 'Finanzas', status: 'inactive', subjectsCount: 0, biometricRegistered: false, lastAccess: '2023-12-20' },
  { id: '6', code: 'DOC006', firstName: 'Dra. Isabel', lastName: 'Ramírez Flores', email: 'isabel.ramirez@umb.edu.co', department: 'Enfermería', specialization: 'Crítica', status: 'active', subjectsCount: 3, biometricRegistered: true, lastAccess: '2024-01-13' },
];

export default function DocentesPage({ navigation }) {
  const { authToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [draft, setDraft] = useState({ fullName: '', email: '', password: '', teacherCode: '' });
  const [showEdit, setShowEdit] = useState(false);
  const [editDraft, setEditDraft] = useState({ email: '', fullName: '', teacherCode: '', password: '' });

  const loadTeachers = async () => {
    try {
      if (!authToken) return;
      if (!ADMIN_TEACHERS_URL) return;
      const resp = await fetch(ADMIN_TEACHERS_URL, {
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
      if (!resp.ok) return;

      const arr = Array.isArray(json?.teachers) ? json.teachers : [];
      const mapped = arr.map((t, idx) => {
        const parts = String(t?.fullName || '').trim().split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ');
        return {
          id: `${String(t?.email || 'row').trim().toLowerCase() || 'row'}-${idx}`,
          code: String(t?.teacherCode || ''),
          firstName,
          lastName,
          email: String(t?.email || ''),
          department: '—',
          specialization: '—',
          status: 'active',
          subjectsCount: Number(t?.subjectsCount || 0),
          biometricRegistered: true,
          lastAccess: '',
        };
      });
      setTeachers(mapped);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadTeachers();
  }, [authToken]);

  const itemsPerPage = 5;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) =>
      t.firstName.toLowerCase().includes(q) ||
      t.lastName.toLowerCase().includes(q) ||
      t.code.includes(q)
    );
  }, [searchQuery, teachers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const statusBadge = (status) => {
    if (status === 'active') return { bg: '#DCFCE7', text: '#15803D', label: 'Activo' };
    if (status === 'inactive') return { bg: '#F3F4F6', text: '#374151', label: 'Inactivo' };
    if (status === 'on_leave') return { bg: '#FEF3C7', text: '#A16207', label: 'Licencia' };
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
            <Text style={styles.headerTitle}>Docentes</Text>
            <Text style={styles.headerSubtitle}>{teachers.length} registrados</Text>
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
          <Pressable
            onPress={() => {
              setDraft({ fullName: '', email: '', password: '', teacherCode: '' });
              setShowModal(true);
            }}
            style={styles.addBtn}
          >
            <Plus size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <View style={[styles.statsIcon, { backgroundColor: '#DBEAFE' }]}>
              <Users size={16} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.statsLabel}>Total</Text>
              <Text style={styles.statsValue}>{teachers.length}</Text>
            </View>
          </View>
          <View style={styles.statsCard}>
            <View style={[styles.statsIcon, { backgroundColor: '#DCFCE7' }]}>
              <CheckCircle size={16} color="#16A34A" />
            </View>
            <View>
              <Text style={styles.statsLabel}>Activos</Text>
              <Text style={styles.statsValue}>{teachers.filter((t) => t.status === 'active').length}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 12 }} />

        {paginated.map((t) => {
          const b = statusBadge(t.status);
          return (
            <View key={t.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.nameText}>{t.firstName} {t.lastName}</Text>
                    <View style={[styles.badge, { backgroundColor: b.bg }]}>
                      <Text style={[styles.badgeText, { color: b.text }]}>{b.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.metaText}>{t.code}</Text>
                  <Text style={styles.metaText}>{t.department} • {t.specialization}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaSmall}>{t.subjectsCount} asignaturas</Text>
                    <Text style={styles.metaSep}>|</Text>
                    {t.biometricRegistered ? (
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
                        email: String(t.email || ''),
                        fullName: String(`${t.firstName} ${t.lastName}`.trim()),
                        teacherCode: String(t.code || ''),
                        password: '',
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
                        `¿Eliminar docente ${t.email || ''}?`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Eliminar',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                if (!authToken) throw new Error('Sesión inválida');
                                if (!ADMIN_DELETE_TEACHER_URL) throw new Error('API no configurada');
                                const resp = await fetch(ADMIN_DELETE_TEACHER_URL, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${authToken}`,
                                  },
                                  body: JSON.stringify({ email: t.email }),
                                });
                                const text = await resp.text();
                                let json;
                                try { json = JSON.parse(text); } catch { json = null; }
                                if (!resp.ok) {
                                  const msg = (json && (json.error || json.message || json.details)) || text || `HTTP ${resp.status}`;
                                  throw new Error(msg);
                                }
                                setTeachers((prev) => prev.filter((x) => x.id !== t.id));
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
            <Text style={styles.modalTitle}>Nuevo Docente</Text>
            <Text style={styles.modalText}>Crea un docente desde el administrador.</Text>

            <View style={{ height: 12 }} />

            <Text style={styles.modalLabel}>Nombre completo</Text>
            <TextInput
              value={draft.fullName}
              onChangeText={(t) => setDraft((p) => ({ ...p, fullName: t }))}
              placeholder="Ej: Ana María Pérez"
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
            />
            <View style={{ height: 10 }} />

            <Text style={styles.modalLabel}>Correo</Text>
            <TextInput
              value={draft.email}
              onChangeText={(t) => setDraft((p) => ({ ...p, email: t }))}
              placeholder="docente@umb.edu.co"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.modalInput}
            />
            <View style={{ height: 10 }} />

            <Text style={styles.modalLabel}>Código docente (opcional)</Text>
            <TextInput
              value={draft.teacherCode}
              onChangeText={(t) => setDraft((p) => ({ ...p, teacherCode: t }))}
              placeholder="DOC001"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              style={styles.modalInput}
            />
            <View style={{ height: 10 }} />

            <Text style={styles.modalLabel}>Contraseña</Text>
            <TextInput
              value={draft.password}
              onChangeText={(t) => setDraft((p) => ({ ...p, password: t }))}
              placeholder="******"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoCapitalize="none"
              style={styles.modalInput}
            />

            <View style={{ height: 12 }} />

            <Button
              fullWidth
              onPress={async () => {
                try {
                  if (!authToken) throw new Error('Sesión inválida');
                  if (!ADMIN_CREATE_TEACHER_URL) throw new Error('API no configurada');

                  const payload = {
                    fullName: String(draft.fullName || '').trim(),
                    email: String(draft.email || '').trim().toLowerCase(),
                    password: String(draft.password || '').trim(),
                    teacherCode: String(draft.teacherCode || '').trim(),
                  };
                  if (!payload.fullName || !payload.email || !payload.password) {
                    throw new Error('Completa nombre, correo y contraseña');
                  }

                  const resp = await fetch(ADMIN_CREATE_TEACHER_URL, {
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

                  setShowModal(false);
                  await loadTeachers();
                } catch (e) {
                  Alert.alert('Error', e?.message || String(e));
                }
              }}
            >
              Guardar
            </Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="outline" onPress={() => setShowModal(false)}>Cancelar</Button>
          </View>
        </View>
      </Modal>

      <Modal visible={showEdit} transparent animationType="fade" onRequestClose={() => setShowEdit(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Docente</Text>
            <Text style={styles.modalText}>{editDraft.email}</Text>

            <View style={{ height: 12 }} />
            <Text style={styles.modalLabel}>Nombre completo</Text>
            <TextInput
              value={editDraft.fullName}
              onChangeText={(t) => setEditDraft((p) => ({ ...p, fullName: t }))}
              placeholder="Ej: Ana María Pérez"
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
            />

            <View style={{ height: 10 }} />
            <Text style={styles.modalLabel}>Código docente</Text>
            <TextInput
              value={editDraft.teacherCode}
              onChangeText={(t) => setEditDraft((p) => ({ ...p, teacherCode: t }))}
              placeholder="DOC001"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              style={styles.modalInput}
            />

            <View style={{ height: 10 }} />
            <Text style={styles.modalLabel}>Nueva contraseña (opcional)</Text>
            <TextInput
              value={editDraft.password}
              onChangeText={(t) => setEditDraft((p) => ({ ...p, password: t }))}
              placeholder="******"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoCapitalize="none"
              style={styles.modalInput}
            />

            <View style={{ height: 12 }} />
            <Button
              fullWidth
              onPress={async () => {
                try {
                  if (!authToken) throw new Error('Sesión inválida');
                  if (!ADMIN_UPDATE_TEACHER_URL) throw new Error('API no configurada');

                  const payload = {
                    email: String(editDraft.email || '').trim().toLowerCase(),
                    fullName: String(editDraft.fullName || '').trim(),
                    teacherCode: String(editDraft.teacherCode || '').trim(),
                    password: String(editDraft.password || '').trim(),
                  };
                  if (!payload.email) throw new Error('Email inválido');

                  const resp = await fetch(ADMIN_UPDATE_TEACHER_URL, {
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
                  await loadTeachers();
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
