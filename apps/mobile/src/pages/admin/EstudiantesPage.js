import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { appAlert } from '../../ui/appNotice';
import {
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  GraduationCap,
  Plus,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react-native';

import OverlayDismiss from '../../components/OverlayDismiss';
import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import {
  ADMIN_CREATE_STUDENT_URL,
  ADMIN_DELETE_STUDENT_URL,
  ADMIN_STUDENTS_URL,
  ADMIN_STUDENTS_BY_CLASS_URL,
  ADMIN_UPDATE_STUDENT_URL,
  VALIDATE_REGISTER_PHOTO_URL,
} from '../../config';
import { useAuth } from '../../state/auth';
import { prettyLabel } from '../../utils/adminDashboard';
import { gapsLabel, requestProfileCompletion, studentGaps } from '../../utils/profileGaps';
import { passwordIssue } from '../../utils/passwordRules';
import { AdminNavButtons, useAdminDrawer } from '../../components/AdminDrawer';

const EMPTY_CREATE = { fullName: '', email: '', studentCode: '', password: '', consentBiometric: false };

export default function EstudiantesPage({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { drawer, openDrawer, goBack } = useAdminDrawer(navigation, 'AdminStudents');
  const { authToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [students, setStudents] = useState([]);
  const [studentsByClass, setStudentsByClass] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editDraft, setEditDraft] = useState({ email: '', fullName: '', studentCode: '', password: '' });
  const [deletingId, setDeletingId] = useState('');
  const [requestingId, setRequestingId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState(EMPTY_CREATE);
  const [createPhoto, setCreatePhoto] = useState(null);
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const [creating, setCreating] = useState(false);

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
              program: String(x?.program || '').trim() || '—',
              semester: String(x?.semester || '').trim() || '—',
              phone: String(x?.phone || '').trim(),
              status: 'active',
              biometricRegistered: x?.hasFace === true || x?.biometricConsent === true,
              acceptTerms: x?.acceptTerms === true,
              acceptPrivacy: x?.acceptPrivacy === true,
              biometricConsent: x?.biometricConsent === true,
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
      s.email.toLowerCase().includes(q) ||
      String(s.program || '').toLowerCase().includes(q) ||
      String(s.semester || '').toLowerCase().includes(q)
    );
  }, [searchQuery, students]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const requestStudent = (s) => {
    const gaps = studentGaps(s);
    if (!gaps.length) {
      appAlert('Al día', 'Este estudiante ya tiene perfil y consentimientos completos.');
      return;
    }
    const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email;
    appAlert(
      'Solicitar datos',
      `Se enviará una notificación a ${name} para que complete: ${gapsLabel(gaps)}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            try {
              setRequestingId(s.id);
              await requestProfileCompletion(authToken, { email: s.email, role: 'student' });
              appAlert('Solicitud enviada', 'El estudiante verá la notificación y, al tocarla, irá a completar lo que falta.');
            } catch (e) {
              appAlert('No se pudo enviar', e?.message || String(e));
            } finally {
              setRequestingId('');
            }
          },
        },
      ]
    );
  };

  const deleteStudent = (s) => {
    const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email;
    appAlert(
      'Eliminar estudiante',
      `Se eliminará a ${name} (${s.email}).\n\nEsto borra su cuenta en DynamoDB, su rostro de la colección biométrica y sus inscripciones a clases.\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!authToken) throw new Error('Sesión inválida');
              if (!ADMIN_DELETE_STUDENT_URL) throw new Error('API no configurada');
              setDeletingId(s.id);
              const resp = await fetch(ADMIN_DELETE_STUDENT_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ email: s.email }),
              });
              const text = await resp.text();
              let json;
              try {
                json = JSON.parse(text);
              } catch {
                json = null;
              }
              if (!resp.ok) {
                const msg =
                  (json && (json.message || json.error || json.details)) ||
                  text ||
                  `HTTP ${resp.status}`;
                throw new Error(msg);
              }
              setStudents((prev) => prev.filter((x) => x.id !== s.id));
              appAlert(
                'Estudiante eliminado',
                'Se quitó el registro y el rostro de la colección de reconocimiento.'
              );
            } catch (e) {
              appAlert('No se pudo eliminar', e?.message || String(e));
            } finally {
              setDeletingId('');
            }
          },
        },
      ]
    );
  };

  const openCreate = () => {
    setCreateDraft(EMPTY_CREATE);
    setCreatePhoto(null);
    setShowCreate(true);
  };

  // Foto biométrica tomada por el admin. Se revisa al momento (calidad y rostro ya registrado).
  const takeStudentPhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        appAlert('Cámara', 'Se necesita permiso de cámara para tomar la foto del estudiante.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.75,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (result.canceled) return;
      const asset = Array.isArray(result.assets) ? result.assets[0] : null;
      const b64 = asset?.base64 ? String(asset.base64) : '';
      if (!b64) {
        appAlert('Foto', 'No se pudo leer la imagen. Intenta otra vez.');
        return;
      }

      if (VALIDATE_REGISTER_PHOTO_URL) {
        setCheckingPhoto(true);
        try {
          const resp = await fetch(VALIDATE_REGISTER_PHOTO_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: b64 }),
          });
          const text = await resp.text();
          let json;
          try { json = JSON.parse(text); } catch { json = null; }
          if (json?.error === 'FaceAlreadyRegistered') {
            appAlert('Rostro ya registrado', json.message || 'Este rostro ya está registrado en otra cuenta.');
            return;
          }
          const issues = Array.isArray(json?.issues) ? json.issues.filter(Boolean) : [];
          if (issues.length || (!resp.ok && resp.status !== 404 && resp.status !== 403)) {
            appAlert(
              'Esta foto no sirve',
              issues.length ? issues.map((item, i) => `${i + 1}. ${item}`).join('\n\n') : (json?.message || `HTTP ${resp.status}`)
            );
            return;
          }
        } finally {
          setCheckingPhoto(false);
        }
      }

      setCreatePhoto({ base64: b64, uri: asset?.uri || '' });
    } catch (e) {
      setCheckingPhoto(false);
      appAlert('Error al tomar la foto', e?.message || String(e));
    }
  };

  const createStudent = async () => {
    const payload = {
      fullName: String(createDraft.fullName || '').trim(),
      email: String(createDraft.email || '').trim().toLowerCase(),
      studentCode: String(createDraft.studentCode || '').trim(),
      password: String(createDraft.password || '').trim(),
      consentBiometric: !!createDraft.consentBiometric,
    };
    if (!payload.fullName || !payload.email || !payload.password) {
      appAlert('Faltan datos', 'Completa nombre, correo y contraseña.');
      return;
    }
    const pwIssue = passwordIssue(payload.password);
    if (pwIssue) {
      appAlert('Contraseña', pwIssue);
      return;
    }
    if (!createPhoto?.base64) {
      appAlert('Foto', 'Toma la foto del rostro del estudiante.');
      return;
    }
    if (!payload.consentBiometric) {
      appAlert('Autorización', 'Confirma que el estudiante autorizó el tratamiento de sus datos biométricos.');
      return;
    }

    setCreating(true);
    try {
      if (!authToken) throw new Error('Sesión inválida');
      if (!ADMIN_CREATE_STUDENT_URL) throw new Error('API no configurada');
      const resp = await fetch(ADMIN_CREATE_STUDENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ ...payload, imageBase64: createPhoto.base64 }),
      });
      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        const msg = (json && (json.message || json.error)) || text || `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      const parts = payload.fullName.split(' ');
      setStudents((prev) => [
        {
          id: `${payload.email}-${Date.now()}`,
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' '),
          code: payload.studentCode,
          email: payload.email,
          program: '—',
          semester: '—',
          phone: '',
          status: 'active',
          biometricRegistered: true,
          acceptTerms: false,
          acceptPrivacy: false,
          biometricConsent: true,
        },
        ...prev,
      ]);
      setShowCreate(false);
      appAlert(
        'Estudiante creado',
        'Entrégale la contraseña temporal. Al iniciar sesión deberá cambiarla y aceptar los términos y la política de privacidad.'
      );
    } catch (e) {
      appAlert('No se pudo crear', e?.message || String(e));
    } finally {
      setCreating(false);
    }
  };

  const statusBadge = (status) => {
    if (status === 'active') return { bg: COLORS.successBg, text: COLORS.success, label: 'Activo' };
    if (status === 'inactive') return { bg: COLORS.surface, text: COLORS.textSecondary, label: 'Inactivo' };
    if (status === 'suspended') return { bg: COLORS.dangerBg, text: COLORS.primary, label: 'Suspendido' };
    return { bg: COLORS.surface, text: COLORS.textSecondary, label: status };
  };

  return (
    <View style={styles.root}>
      {drawer}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <AdminNavButtons onBack={goBack} onMenu={openDrawer} buttonStyle={styles.backBtn} size={20} color={COLORS.icon} />
          <View>
            <Text style={styles.headerTitle}>Estudiantes</Text>
            <Text style={styles.headerSubtitle}>{students.length} registrados</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Search size={16} color={COLORS.placeholder} />
            <TextInput
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                setCurrentPage(1);
              }}
              placeholder="Buscar..."
              placeholderTextColor={COLORS.placeholder}
              style={styles.searchInput}
            />
          </View>
          <Pressable onPress={openCreate} style={styles.addBtn}>
            <Plus size={18} color={COLORS.white} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <View style={[styles.statsIcon, { backgroundColor: COLORS.surface }]}>
              <GraduationCap size={16} color={COLORS.icon} />
            </View>
            <View>
              <Text style={styles.statsLabel}>Total</Text>
              <Text style={styles.statsValue}>{students.length}</Text>
            </View>
          </View>
          <View style={styles.statsCard}>
            <View style={[styles.statsIcon, { backgroundColor: COLORS.successBg }]}>
              <CheckCircle size={16} color={COLORS.successStrong} />
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
          const gaps = studentGaps(s);
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
                  <Text style={styles.profileLine}>Carrera: {prettyLabel(s.program, 'Pendiente en perfil')}</Text>
                  <Text style={styles.profileLine}>Semestre: {prettyLabel(s.semester, 'Pendiente en perfil')}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaSmall}>{s.email}</Text>
                  </View>
                  <View style={styles.consentRow}>
                    {s.biometricRegistered ? (
                      <View style={styles.bioRow}>
                        <CheckCircle size={12} color={COLORS.successStrong} />
                        <Text style={[styles.metaSmall, { color: COLORS.successStrong }]}>Biometría</Text>
                      </View>
                    ) : (
                      <View style={styles.bioRow}>
                        <XCircle size={12} color={COLORS.dangerStrong} />
                        <Text style={[styles.metaSmall, { color: COLORS.dangerStrong }]}>Sin biometría</Text>
                      </View>
                    )}
                    <Text style={styles.metaSep}>|</Text>
                    <Text style={[styles.metaSmall, { color: s.acceptTerms ? COLORS.successStrong : COLORS.dangerStrong }]}>
                      {s.acceptTerms ? 'Términos' : 'Sin términos'}
                    </Text>
                    <Text style={styles.metaSep}>|</Text>
                    <Text style={[styles.metaSmall, { color: s.acceptPrivacy ? COLORS.successStrong : COLORS.dangerStrong }]}>
                      {s.acceptPrivacy ? 'Privacidad' : 'Sin privacidad'}
                    </Text>
                  </View>
                  {gaps.length ? (
                    <Pressable
                      onPress={() => requestStudent(s)}
                      disabled={requestingId === s.id}
                      style={styles.requestBtn}
                    >
                      <Send size={14} color={COLORS.primary} />
                      <Text style={styles.requestBtnText}>
                        {requestingId === s.id ? 'Enviando…' : `Solicitar: ${gapsLabel(gaps)}`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.actionsCol}>
                  <Pressable
                    style={styles.iconAction}
                    onPress={() => {
                      setEditDraft({
                        email: String(s.email || ''),
                        fullName: String(`${s.firstName} ${s.lastName}`.trim()),
                        studentCode: String(s.code || ''),
                        password: '',
                      });
                      setShowEdit(true);
                    }}
                  >
                    <Edit2 size={16} color={COLORS.primary} />
                  </Pressable>
                  <Pressable
                    style={[styles.deleteBtn, deletingId === s.id ? styles.deleteBtnDisabled : null]}
                    onPress={() => deleteStudent(s)}
                    disabled={deletingId === s.id}
                  >
                    <Trash2 size={14} color={COLORS.dangerStrong} />
                    <Text style={styles.deleteBtnText}>
                      {deletingId === s.id ? 'Borrando…' : 'Eliminar'}
                    </Text>
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
              <ChevronLeft size={16} color={COLORS.icon} />
            </Pressable>
            <Pressable
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={[styles.pageBtn, page === totalPages ? styles.pageBtnDisabled : null]}
            >
              <ChevronRight size={16} color={COLORS.icon} />
            </Pressable>
          </View>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <OverlayDismiss style={styles.modalOverlay} onClose={() => setShowCreate(false)}>
          <View style={[styles.modalCard, styles.modalCardTall]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Nuevo Estudiante</Text>
              <Text style={styles.modalText}>Crea la cuenta y toma la foto para el reconocimiento facial.</Text>

              <View style={{ height: 12 }} />
              <Text style={styles.modalLabel}>Nombre completo</Text>
              <TextInput
                value={createDraft.fullName}
                onChangeText={(t) => setCreateDraft((p) => ({ ...p, fullName: t }))}
                placeholder="Ej: Juan Pérez"
                placeholderTextColor={COLORS.placeholder}
                style={styles.modalInput}
              />

              <View style={{ height: 10 }} />
              <Text style={styles.modalLabel}>Correo</Text>
              <TextInput
                value={createDraft.email}
                onChangeText={(t) => setCreateDraft((p) => ({ ...p, email: t }))}
                placeholder="estudiante@academia.umb.edu.co"
                placeholderTextColor={COLORS.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.modalInput}
              />

              <View style={{ height: 10 }} />
              <Text style={styles.modalLabel}>Código estudiante (opcional)</Text>
              <TextInput
                value={createDraft.studentCode}
                onChangeText={(t) => setCreateDraft((p) => ({ ...p, studentCode: t }))}
                placeholder="2023..."
                placeholderTextColor={COLORS.placeholder}
                autoCapitalize="none"
                style={styles.modalInput}
              />

              <View style={{ height: 10 }} />
              <Text style={styles.modalLabel}>Contraseña temporal</Text>
              <TextInput
                value={createDraft.password}
                onChangeText={(t) => setCreateDraft((p) => ({ ...p, password: t }))}
                placeholder="Mín. 8, mayúscula, número y símbolo"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry
                autoCapitalize="none"
                style={styles.modalInput}
              />
              <Text style={styles.modalHint}>El estudiante deberá cambiarla al iniciar sesión.</Text>

              <View style={{ height: 12 }} />
              <Text style={styles.modalLabel}>Foto del rostro</Text>
              <View style={styles.photoRow}>
                {createPhoto?.uri ? (
                  <Image source={{ uri: createPhoto.uri }} style={styles.photoPreview} />
                ) : (
                  <View style={[styles.photoPreview, styles.photoEmpty]}>
                    <Camera size={22} color={COLORS.placeholder} />
                  </View>
                )}
                <Pressable
                  onPress={takeStudentPhoto}
                  disabled={checkingPhoto || creating}
                  style={[styles.photoBtn, checkingPhoto ? styles.deleteBtnDisabled : null]}
                >
                  {checkingPhoto ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Camera size={16} color={COLORS.primary} />
                  )}
                  <Text style={styles.photoBtnText}>
                    {checkingPhoto ? 'Revisando…' : createPhoto ? 'Tomar otra' : 'Tomar foto'}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.modalHint}>Un solo rostro, de frente, sin gafas y con buena luz.</Text>

              <View style={styles.consentSwitchRow}>
                <Text style={styles.consentSwitchText}>
                  El estudiante autorizó el tratamiento de sus datos biométricos
                </Text>
                <Switch
                  value={!!createDraft.consentBiometric}
                  onValueChange={(v) => setCreateDraft((p) => ({ ...p, consentBiometric: v }))}
                />
              </View>

              <View style={{ height: 14 }} />
              <Button fullWidth onPress={createStudent} disabled={creating || checkingPhoto}>
                {creating ? 'Creando…' : 'Crear estudiante'}
              </Button>
              <View style={{ height: 10 }} />
              <Button fullWidth variant="outline" onPress={() => setShowCreate(false)}>Cancelar</Button>
            </ScrollView>
          </View>
        </OverlayDismiss>
      </Modal>

      <Modal visible={showEdit} transparent animationType="fade" onRequestClose={() => setShowEdit(false)}>
        <OverlayDismiss style={styles.modalOverlay} onClose={() => setShowEdit(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Estudiante</Text>
            <Text style={styles.modalText}>{editDraft.email}</Text>

            <View style={{ height: 12 }} />
            <Text style={styles.modalLabel}>Nombre completo</Text>
            <TextInput
              value={editDraft.fullName}
              onChangeText={(t) => setEditDraft((p) => ({ ...p, fullName: t }))}
              placeholder="Ej: Juan Pérez"
              placeholderTextColor={COLORS.placeholder}
              style={styles.modalInput}
            />

            <View style={{ height: 10 }} />
            <Text style={styles.modalLabel}>Código estudiante</Text>
            <TextInput
              value={editDraft.studentCode}
              onChangeText={(t) => setEditDraft((p) => ({ ...p, studentCode: t }))}
              placeholder="2023..."
              placeholderTextColor={COLORS.placeholder}
              autoCapitalize="none"
              style={styles.modalInput}
            />

            <View style={{ height: 10 }} />
            <Text style={styles.modalLabel}>Contraseña temporal (opcional)</Text>
            <TextInput
              value={editDraft.password}
              onChangeText={(t) => setEditDraft((p) => ({ ...p, password: t }))}
              placeholder="Para restablecer el acceso"
              placeholderTextColor={COLORS.placeholder}
              secureTextEntry
              autoCapitalize="none"
              style={styles.modalInput}
            />
            <Text style={styles.modalHint}>El estudiante deberá cambiarla al iniciar sesión.</Text>

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
                  const tempPassword = String(editDraft.password || '').trim();
                  if (tempPassword) payload.password = tempPassword;
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
                    const msg = (json && (json.message || json.error)) || text || `HTTP ${resp.status}`;
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
                  appAlert('Error', e?.message || String(e));
                }
              }}
            >
              Guardar
            </Button>
            <View style={{ height: 10 }} />
            <Button fullWidth variant="outline" onPress={() => setShowEdit(false)}>Cancelar</Button>
          </View>
        </OverlayDismiss>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.card, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.surface },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: COLORS.text },
  addBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 26 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statsCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  statsIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statsLabel: { color: COLORS.muted, fontSize: 12 },
  statsValue: { marginTop: 2, fontWeight: '900', color: COLORS.text, fontSize: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nameText: { fontWeight: '900', color: COLORS.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontWeight: '900', fontSize: 12 },
  metaText: { marginTop: 4, color: COLORS.muted },
  profileLine: { marginTop: 4, color: COLORS.textSecondary, fontSize: 13, fontWeight: '800' },
  metaRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaSmall: { fontSize: 12, color: COLORS.muted },
  metaSep: { color: COLORS.border },
  bioRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  consentRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  requestBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  requestBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 12, flexShrink: 1 },
  actionsCol: { gap: 10 },
  iconAction: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { color: COLORS.dangerStrong, fontWeight: '800', fontSize: 11 },
  pagination: { marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
  paginationText: { color: COLORS.muted, fontSize: 12 },
  paginationBtns: { flexDirection: 'row', gap: 10 },
  pageBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled: { opacity: 0.45 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 },
  modalCardTall: { maxHeight: '90%' },
  modalTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  modalText: { marginTop: 6, color: COLORS.muted },
  modalLabel: { marginTop: 8, color: COLORS.textSecondary, fontWeight: '900', fontSize: 12 },
  modalHint: { marginTop: 6, color: COLORS.textSecondary, fontSize: 12 },
  photoRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoPreview: { width: 72, height: 96, borderRadius: 12 },
  photoEmpty: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  photoBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  consentSwitchRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  consentSwitchText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  modalInput: { marginTop: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text },
});
