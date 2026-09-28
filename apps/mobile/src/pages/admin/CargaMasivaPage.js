import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { appAlert } from '../../ui/appNotice';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Upload
} from 'lucide-react-native';

import { Button } from '../../components/Button';
import { COLORS } from '../../ui/theme';
import { useColors } from '../../ui/ThemeContext';
import { ADMIN_BULK_IMPORT_URL } from '../../config';
import { useAuth } from '../../state/auth';

const KINDS = [
  {
    id: 'docentes',
    label: 'Docentes',
    hint: 'Crea la cuenta. La contraseña es temporal y el docente debe cambiarla al entrar.',
    template: 'nombre,correo,contrasena,codigo\nDocente prueba,docente1@umb.edu.co,Prueba2026!,DOC-PRU\n',
  },
  {
    id: 'asignaturas',
    label: 'Asignaturas',
    hint: 'Crea la clase de un docente que ya exista. Los días van separados por |.',
    template: 'nombre,grupo,inicio,fin,salon,docente,codigo,periodo,dias\nPrueba de asistencia,A,07:00,09:00,101,docente1@umb.edu.co,PRU101,2026-1,lunes|miercoles\n',
  },
  {
    id: 'estudiantes',
    label: 'Estudiantes',
    hint: 'Inscribe en una clase a estudiantes que ya se registraron con foto. No crea cuentas nuevas. El nombre es solo referencia; la carga usa el correo.',
    template: 'correo,nombre,clase,grupo,docente\njulianlucas@academia.umb.edu.co,Julián Ruiz Guzmán,Prueba de asistencia,A,docente1@umb.edu.co\n',
  },
];

function exampleParts(template) {
  const [headerLine = '', valueLine = ''] = String(template || '').trim().split('\n');
  return {
    headers: headerLine.split(','),
    values: valueLine.split(','),
    csv: `${headerLine}\n${valueLine}`,
  };
}

function foldHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function splitCsvLine(line, delimiter) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (source.startsWith('PK')) {
    throw new Error('Ese archivo es Excel. En Excel usa Guardar como y elige CSV.');
  }
  const lines = source.split('\n').filter((line) => line.trim());
  if (lines.length < 2) throw new Error('El archivo necesita un encabezado y al menos una fila.');
  const delimiter = lines[0].split(';').length > lines[0].split(',').length ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map(foldHeader);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i], delimiter);
    if (cells.every((cell) => !String(cell || '').trim())) continue;
    const row = { _line: i + 1 };
    headers.forEach((header, index) => {
      if (!header) return;
      row[header] = cells[index] || '';
    });
    rows.push(row);
  }
  if (!rows.length) throw new Error('El archivo no tiene filas para cargar.');
  if (rows.length > 40) throw new Error('El archivo puede tener hasta 40 filas por carga.');
  return rows;
}

function pick(row, ...keys) {
  for (const key of keys) {
    const value = row[foldHeader(key)];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function detectKind(rows) {
  const keys = new Set();
  rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
  const has = (...names) => names.some((name) => keys.has(foldHeader(name)));
  const filled = (...names) => names.some((name) => rows.some((row) => pick(row, name)));
  if ((has('clase') || has('asignatura')) && (has('correo') || has('email') || has('docente')) && !filled('contrasena', 'password')) {
    return 'estudiantes';
  }
  if (filled('contrasena', 'password')) return 'docentes';
  if (has('inicio') || has('horaInicio') || has('salon') || has('aula') || has('fin') || has('horaFin')) return 'asignaturas';
  if (has('clase') || has('asignatura') || has('docente')) return 'estudiantes';
  return '';
}

function toPayloadRows(kind, rows) {
  return rows.map((row) => {
    const base = { ...row, line: row._line };
    if (kind === 'docentes') {
      return {
        ...base,
        fullName: pick(row, 'nombre', 'nombreDocente', 'fullName'),
        email: pick(row, 'correo', 'email'),
        password: pick(row, 'contrasena', 'password'),
        teacherCode: pick(row, 'codigo', 'codigoDocente'),
      };
    }
    if (kind === 'asignaturas') {
      return {
        ...base,
        className: pick(row, 'nombre', 'asignatura', 'clase'),
        group: pick(row, 'grupo'),
        startTime: pick(row, 'inicio', 'horaInicio'),
        endTime: pick(row, 'fin', 'horaFin'),
        room: pick(row, 'salon', 'aula'),
        teacherEmail: pick(row, 'docente', 'correoDocente'),
        subjectCode: pick(row, 'codigo', 'codigoAsignatura'),
        period: pick(row, 'periodo'),
        days: pick(row, 'dias'),
      };
    }
    return {
      ...base,
      email: pick(row, 'correo', 'correoEstudiante', 'email'),
      className: pick(row, 'clase', 'asignatura'),
      group: pick(row, 'grupo'),
      teacherEmail: pick(row, 'docente', 'correoDocente'),
      classId: pick(row, 'claseId', 'classId'),
    };
  });
}

export default function CargaMasivaPage({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { authToken } = useAuth();
  const [kind, setKind] = useState('docentes');
  const [file, setFile] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);

  const selected = KINDS.find((item) => item.id === kind) || KINDS[0];
  const example = exampleParts(selected.template);

  const shareTemplate = async () => {
    try {
      const path = `${FileSystem.cacheDirectory || ''}plantilla-${kind}.csv`;
      await FileSystem.writeAsStringAsync(path, selected.template);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        appAlert('Plantilla', 'No se pudo abrir el menú para compartir el archivo.');
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: `Plantilla de ${selected.label.toLowerCase()}`,
        UTI: 'public.comma-separated-values-text',
      });
    } catch (error) {
      appAlert('Plantilla', error?.message || 'No se pudo compartir la plantilla.');
    }
  };

  const chooseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const name = String(asset.name || 'archivo.csv');
      if (/\.xlsx?$/i.test(name)) {
        appAlert('Usa CSV', 'En Excel abre el archivo y elige Guardar como CSV.');
        return;
      }
      const text = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = parseCsv(text);
      const detected = detectKind(parsed) || kind;
      setKind(detected);
      setFile({ name, size: Number(asset.size || 0) });
      setRawRows(parsed);
      setRows(toPayloadRows(detected, parsed));
      setSummary(null);
    } catch (error) {
      setFile(null);
      setRawRows([]);
      setRows([]);
      appAlert('Archivo', error?.message || 'No se pudo leer el archivo.');
    }
  };

  const changeKind = (next) => {
    setKind(next);
    setRows(rawRows.length ? toPayloadRows(next, rawRows) : []);
    setSummary(null);
  };

  const upload = async () => {
    if (!rows.length) return;
    if (!authToken || !ADMIN_BULK_IMPORT_URL) {
      appAlert('Carga', 'La API no está configurada en este dispositivo.');
      return;
    }
    const uploadKind = detectKind(rawRows) || kind;
    const payloadRows = rawRows.length ? toPayloadRows(uploadKind, rawRows) : rows;
    setBusy(true);
    try {
      const resp = await fetch(ADMIN_BULK_IMPORT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ kind: uploadKind, rows: payloadRows }),
      });
      const text = await resp.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!resp.ok) {
        throw new Error(json?.message || json?.error || text || `HTTP ${resp.status}`);
      }
      setSummary({
        fileName: file?.name || 'archivo.csv',
        created: Number(json?.created || 0),
        skipped: Number(json?.skipped || 0),
        failed: Number(json?.failed || 0),
        results: Array.isArray(json?.results) ? json.results : [],
      });
      setFile(null);
      setRows([]);
    } catch (error) {
      appAlert('Carga', error?.message || 'No se pudo completar la carga.');
    } finally {
      setBusy(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={COLORS.icon} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Carga masiva</Text>
          <Text style={styles.headerSubtitle}>Importa un archivo CSV</Text>
        </View>
        <Pressable onPress={shareTemplate} style={styles.iconBtn}>
          <Download size={18} color={COLORS.icon} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>Tipo de datos</Text>
          <View style={styles.typeGrid}>
            {KINDS.map((item) => {
              const active = kind === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => changeKind(item.id)}
                  style={[styles.typePill, active ? styles.typePillActive : null]}
                >
                  <Text style={[styles.typeText, active ? styles.typeTextActive : null]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{selected.hint}</Text>
          <Text style={styles.exampleTitle}>Ejemplo en tabla</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                {example.headers.map((header, index) => (
                  <View key={`head-${index}`} style={[styles.tableCell, styles.tableHead]}>
                    <Text style={styles.tableHeadText}>{header}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.tableRow}>
                {example.values.map((value, index) => (
                  <View key={`value-${index}`} style={styles.tableCell}>
                    <Text style={styles.tableCellText}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
          <Text style={styles.exampleTitle}>Separados por comas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {example.csv.split('\n').map((line, index) => (
                <Text key={`csv-${index}`} style={styles.exampleCode}>{line}</Text>
              ))}
            </View>
          </ScrollView>
          <View style={styles.dropZone}>
            <View style={styles.dropIcon}>
              <Upload size={24} color={COLORS.placeholder} />
            </View>
            <Text style={styles.dropTitle}>Elige un archivo CSV</Text>
            <Text style={styles.dropSub}>Hasta 40 filas. El botón de descarga comparte la plantilla.</Text>
            <View style={{ height: 10 }} />
            <Button fullWidth onPress={chooseFile}>Seleccionar archivo</Button>
          </View>
        </View>

        {rows.length > 0 ? (
          <View style={[styles.card, { marginTop: 12, padding: 0, overflow: 'hidden' }]}>
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>Listo para cargar</Text>
            </View>
            <View style={styles.fileRow}>
              <View style={styles.fileIcon}>
                <FileSpreadsheet size={18} color={COLORS.successStrong} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName}>{file?.name || 'archivo.csv'}</Text>
                <Text style={styles.fileMeta}>
                  {selected.label} · {rows.length} {rows.length === 1 ? 'fila' : 'filas'}
                  {file?.size ? ` · ${formatSize(file.size)}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.listFooter}>
              <Button fullWidth isLoading={busy} onPress={upload}>Iniciar carga</Button>
            </View>
          </View>
        ) : null}

        {summary ? (
          <View style={[styles.card, { marginTop: 12, padding: 0, overflow: 'hidden' }]}>
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>Resultado</Text>
            </View>
            <View style={styles.fileRow}>
              <View style={[styles.fileIcon, { backgroundColor: summary.failed ? COLORS.warningBg : COLORS.successBg }]}>
                {summary.failed ? (
                  <AlertCircle size={18} color={COLORS.warning} />
                ) : (
                  <CheckCircle size={18} color={COLORS.successStrong} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName}>{summary.fileName}</Text>
                <Text style={styles.fileMeta}>
                  {summary.created} creados · {summary.skipped} ya existían · {summary.failed} con error
                </Text>
              </View>
            </View>
            {summary.results.filter((row) => !row.ok).map((row) => (
              <View key={`${row.line}-${row.email || row.message}`} style={styles.errorRow}>
                <Text style={styles.errorLine}>Fila {row.line}</Text>
                <Text style={styles.errorText}>{row.message}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ height: 18 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.surface },
  iconBtn: { padding: 10, borderRadius: 14, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontWeight: '900', color: COLORS.text, fontSize: 18 },
  headerSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  body: { padding: 16, paddingBottom: 26 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  label: { fontWeight: '900', color: COLORS.textSecondary },
  typeGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typePill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  typePillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  typeText: { fontWeight: '900', color: COLORS.muted },
  typeTextActive: { color: COLORS.primary },
  hint: { marginTop: 8, marginBottom: 12, color: COLORS.muted, lineHeight: 18, fontSize: 13 },
  exampleTitle: { marginTop: 4, marginBottom: 8, fontWeight: '900', color: COLORS.text },
  table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: 'hidden', marginBottom: 12 },
  tableRow: { flexDirection: 'row' },
  tableCell: {
    width: 148,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  tableHead: { backgroundColor: COLORS.surface },
  tableHeadText: { fontWeight: '900', color: COLORS.textSecondary, fontSize: 12 },
  tableCellText: { color: COLORS.text, fontSize: 12 },
  exampleCode: {
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  dropZone: { borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center' },
  dropIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  dropTitle: { marginTop: 10, fontWeight: '900', color: COLORS.textSecondary },
  dropSub: { marginTop: 6, color: COLORS.muted, fontSize: 12, textAlign: 'center' },
  listHeader: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listHeaderText: { fontWeight: '900', color: COLORS.text },
  fileRow: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.successBg, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontWeight: '900', color: COLORS.text },
  fileMeta: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  listFooter: { padding: 12, paddingTop: 0 },
  errorRow: { paddingHorizontal: 12, paddingBottom: 12 },
  errorLine: { fontWeight: '900', color: COLORS.dangerStrong, fontSize: 12 },
  errorText: { marginTop: 2, color: COLORS.textSecondary, fontSize: 13 },
});
