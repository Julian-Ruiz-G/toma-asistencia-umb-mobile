import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  X,
} from 'lucide-react-native';

import { COLORS } from '../../ui/theme';
import { ATTENDANCE_REPORT_URL } from '../../config';
import { useAuth } from '../../state/auth';
import { exportAttendanceReport } from '../../utils/reportExport';
import { Button } from '../../components/Button';

// Parsea el CSV del backend en filas/columnas
function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/);
  return lines
    .map((line) => {
      // Manejo básico de campos con comillas
      const cols = [];
      let cur = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuote = !inQuote;
        } else if (ch === ',' && !inQuote) {
          cols.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      cols.push(cur);
      return cols;
    })
    .filter((row) => row.some((c) => c.trim() !== ''));
}

// Detecta a partir de qué fila empieza la tabla de estudiantes
function splitHeaderAndTable(rows) {
  // La cabecera del informe son pares clave/valor hasta encontrar la fila con '#'
  let tableStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const first = String(rows[i][0] || '').trim().toUpperCase();
    if (first === '#') {
      tableStart = i;
      break;
    }
  }
  if (tableStart === -1) {
    return { meta: [], columns: [], dataRows: [] };
  }
  const meta = rows.slice(0, tableStart).filter((r) => r.length >= 2 && r[0].trim());
  const columns = rows[tableStart];
  const dataRows = rows.slice(tableStart + 1);
  return { meta, columns, dataRows };
}

const STATUS_COLORS = {
  X_SI: { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' },   // asistencia
  X_NO: { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' },   // inasistencia
  X_RET: { bg: '#FEF9C3', text: '#854D0E', border: '#FDE047' },  // retardo
  default: { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
};

function getCellStyle(colLabel, value) {
  const col = String(colLabel || '').toUpperCase().trim();
  const val = String(value || '').trim().toUpperCase();
  if (col === 'SI' && val === 'X') return STATUS_COLORS.X_SI;
  if (col === 'NO' && val === 'X') return STATUS_COLORS.X_NO;
  if (col === 'RETARDO' && val === 'X') return STATUS_COLORS.X_RET;
  return null;
}

export default function ReportPreview({ navigation, route }) {
  const { authToken } = useAuth();
  const sessionId = String(route?.params?.sessionId || '').trim();
  const classMeta = route?.params?.classMeta;

  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewFormat, setPreviewFormat] = useState(null); // 'csv'|'xlsx'|'pdf'|null

  const load = useCallback(async () => {
    if (!ATTENDANCE_REPORT_URL || !authToken || !sessionId) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(ATTENDANCE_REPORT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      const text = await resp.text();
      if (!resp.ok) {
        let msg = text;
        try { const j = JSON.parse(text); msg = j.error || j.message || j.details || msg; } catch { /* ok */ }
        throw new Error(typeof msg === 'string' ? msg : `HTTP ${resp.status}`);
      }
      setCsvText(text);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [authToken, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = parseCsv(csvText);
  const { meta, columns, dataRows } = splitHeaderAndTable(rows);

  const handleDownload = async (format) => {
    if (!authToken || !sessionId) return;
    setIsDownloading(true);
    try {
      await exportAttendanceReport(authToken, sessionId, format);
    } catch (e) {
      // handled internally
    } finally {
      setIsDownloading(false);
      setPreviewFormat(null);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.titleRow}>
            <FileSpreadsheet size={17} color="#16A34A" />
            <Text style={styles.headerTitle}>Reporte de Asistencia</Text>
          </View>
          <Text style={styles.headerSub} numberOfLines={1}>
            {classMeta?.title || 'Clase'}
            {classMeta?.group ? ` • Grupo ${classMeta.group}` : ''}
          </Text>
        </View>
        <Pressable onPress={load} style={styles.iconBtn} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <RefreshCw size={18} color="#4B5563" />}
        </Pressable>
      </View>

      {/* Contenido principal */}
      {loading && !csvText ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Cargando informe…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <RefreshCw size={16} color="#fff" />
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : !csvText ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Sin datos para mostrar</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>

          {/* ── Cabecera del informe (metadatos) ── */}
          {meta.length > 0 && (
            <View style={styles.metaCard}>
              <Text style={styles.metaTitle}>Información del informe</Text>
              {meta.map((row, i) => (
                <View key={i} style={styles.metaRow}>
                  <Text style={styles.metaKey}>{String(row[0] || '').replace(/_/g, ' ')}</Text>
                  <Text style={styles.metaVal}>{String(row[1] || '')}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Tabla de estudiantes ── */}
          {columns.length > 0 && (
            <View style={styles.tableWrap}>
              <Text style={styles.tableTitle}>Listado de asistencia</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  {/* Encabezado */}
                  <View style={styles.theadRow}>
                    {columns.map((col, ci) => (
                      <View key={ci} style={[styles.th, { width: colWidth(col) }]}>
                        <Text style={styles.thText}>{String(col || '').replace(/_/g, ' ')}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Filas */}
                  {dataRows.map((row, ri) => (
                    <View key={ri} style={[styles.tr, ri % 2 === 1 && styles.trAlt]}>
                      {columns.map((col, ci) => {
                        const val = String(row[ci] || '');
                        const accent = getCellStyle(col, val);
                        return (
                          <View
                            key={ci}
                            style={[
                              styles.td,
                              { width: colWidth(col) },
                              accent ? { backgroundColor: accent.bg, borderColor: accent.border } : null,
                            ]}
                          >
                            <Text
                              style={[styles.tdText, accent ? { color: accent.text, fontWeight: '900' } : null]}
                              numberOfLines={2}
                            >
                              {val}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Leyenda */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]} />
                  <Text style={styles.legendText}>Asistió</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FEF9C3', borderColor: '#FDE047' }]} />
                  <Text style={styles.legendText}>Retardo</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]} />
                  <Text style={styles.legendText}>Inasistencia</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Botones de descarga ── */}
          <View style={styles.downloadSection}>
            <View style={styles.downloadHeader}>
              <View style={styles.downloadHeaderLine} />
              <View style={styles.downloadHeaderBadge}>
                <Download size={14} color="#6B7280" />
                <Text style={styles.downloadTitle}>EXPORTAR INFORME</Text>
              </View>
              <View style={styles.downloadHeaderLine} />
            </View>
            <View style={styles.downloadBtns}>
              <Pressable
                style={({ pressed }) => [styles.dlBtn, pressed && styles.dlBtnPressed]}
                onPress={() => setPreviewFormat('csv')}
              >
                <View style={[styles.dlBtnIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <FileText size={28} color="#16A34A" />
                </View>
                <Text style={styles.dlBtnText}>CSV</Text>
                <Text style={styles.dlBtnSub}>Texto</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.dlBtn, pressed && styles.dlBtnPressed]}
                onPress={() => setPreviewFormat('xlsx')}
              >
                <View style={[styles.dlBtnIconWrap, { backgroundColor: '#DBEAFE' }]}>
                  <FileSpreadsheet size={28} color="#2563EB" />
                </View>
                <Text style={styles.dlBtnText}>Excel</Text>
                <Text style={styles.dlBtnSub}>Tabla</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.dlBtn, pressed && styles.dlBtnPressed]}
                onPress={() => setPreviewFormat('pdf')}
              >
                <View style={[styles.dlBtnIconWrap, { backgroundColor: '#FEE2E2' }]}>
                  <FileText size={28} color="#DC2626" />
                </View>
                <Text style={styles.dlBtnText}>PDF</Text>
                <Text style={styles.dlBtnSub}>Imprimir</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ── Modal de previsualización por formato ── */}
      <Modal visible={!!previewFormat} transparent animationType="slide" onRequestClose={() => setPreviewFormat(null)}>
        <View style={mp.overlay}>
          <View style={mp.sheet}>
            <View style={mp.sheetHeader}>
              <Text style={mp.sheetTitle}>
                Vista previa — {previewFormat === 'csv' ? 'CSV' : previewFormat === 'xlsx' ? 'Excel' : 'PDF'}
              </Text>
              <Pressable onPress={() => setPreviewFormat(null)} style={mp.closeBtn}>
                <X size={20} color="#6B7280" />
              </Pressable>
            </View>

            <View style={mp.actionArea}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  mp.downloadConfirm,
                  { backgroundColor: previewFormat === 'csv' ? '#16A34A' : previewFormat === 'xlsx' ? '#2563EB' : '#DC2626' },
                  isDownloading && { opacity: 0.5 }
                ]}
                onPress={() => handleDownload(previewFormat)}
                disabled={isDownloading}
              >
                {isDownloading
                  ? <ActivityIndicator color="#ffffff" size="small" />
                  : <Download size={20} color="#ffffff" />}
                <Text style={mp.downloadConfirmText}>
                  {isDownloading ? 'Generando…' : 'Descargar'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 0 }}>
              {previewFormat === 'csv' && (
                <View style={mp.csvBox}>
                  <Text style={mp.csvBadge}>archivo.csv — texto plano</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      {meta.map((r, i) => (
                        <Text key={`m${i}`} style={mp.csvLine}>{r[0]},{r[1] || ''}</Text>
                      ))}
                      <Text style={mp.csvLine} />
                      <Text style={mp.csvLine}>{columns.join(',')}</Text>
                      {dataRows.slice(0, 8).map((r, i) => (
                        <Text key={i} style={mp.csvLine}>{r.join(',')}</Text>
                      ))}
                      {dataRows.length > 8 && <Text style={mp.csvLine}>… {dataRows.length - 8} filas más</Text>}
                    </View>
                  </ScrollView>
                </View>
              )}

              {previewFormat === 'xlsx' && (
                <View style={mp.xlsxBox}>
                  <View style={mp.xlsxBar}>
                    <Text style={mp.xlsxBarText}>Libro1.xlsx — Hoja de cálculo</Text>
                    <Text style={mp.xlsxBarDot}>● ● ●</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <View style={mp.xlsxHead}>
                        {columns.slice(0, 8).map((c, i) => (
                          <View key={i} style={[mp.xlsxTh, { width: xColW(c) }]}>
                            <Text style={mp.xlsxThText} numberOfLines={1}>{String(c).replace(/_/g, ' ')}</Text>
                          </View>
                        ))}
                      </View>
                      {dataRows.slice(0, 8).map((row, ri) => (
                        <View key={ri} style={[mp.xlsxTr, ri % 2 === 1 && { backgroundColor: '#F2F2F2' }]}>
                          {columns.slice(0, 8).map((col, ci) => {
                            const val = String(row[ci] || '');
                            const bg = xCellBg(col, val);
                            return (
                              <View key={ci} style={[mp.xlsxTd, { width: xColW(col) }, bg && { backgroundColor: bg }]}>
                                <Text style={[mp.xlsxTdText, bg && { fontWeight: '700' }]} numberOfLines={1}>{val}</Text>
                              </View>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  {dataRows.length > 8 && <Text style={mp.xlsxMore}>… {dataRows.length - 8} filas más</Text>}
                </View>
              )}

              {previewFormat === 'pdf' && (
                <View style={mp.pdfPage}>
                  <View style={mp.pdfHeader}>
                    <Text style={mp.pdfHeaderTitle}>UNIVERSIDAD METROPOLITANA</Text>
                    <Text style={mp.pdfHeaderSub}>INFORME DE ASISTENCIA</Text>
                  </View>
                  {meta.slice(0, 5).map((r, i) => (
                    <View key={i} style={mp.pdfMetaRow}>
                      <Text style={mp.pdfMetaKey}>{String(r[0]).replace(/_/g, ' ')}:</Text>
                      <Text style={mp.pdfMetaVal}>{String(r[1] || '')}</Text>
                    </View>
                  ))}
                  <View style={{ height: 8 }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <View style={mp.pdfThead}>
                        {columns.slice(0, 7).map((c, i) => (
                          <View key={i} style={[mp.pdfTh, { width: pColW(c) }]}>
                            <Text style={mp.pdfThText} numberOfLines={1}>{String(c).replace(/_/g, ' ')}</Text>
                          </View>
                        ))}
                      </View>
                      {dataRows.slice(0, 6).map((row, ri) => (
                        <View key={ri} style={mp.pdfTr}>
                          {columns.slice(0, 7).map((col, ci) => (
                            <View key={ci} style={[mp.pdfTd, { width: pColW(col) }]}>
                              <Text style={mp.pdfTdText} numberOfLines={1}>{String(row[ci] || '')}</Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  {dataRows.length > 6 && <Text style={mp.pdfMore}>… {dataRows.length - 6} registros más</Text>}
                  <Text style={mp.pdfFoot}>Generado automáticamente — Sistema de Asistencia UMB</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function colWidth(col) {
  const c = String(col || '').toUpperCase().trim();
  if (c === '#') return 40;
  if (c === 'SI' || c === 'NO') return 44;
  if (c === 'RETARDO') return 70;
  if (c === 'SESION') return 180;
  if (c === 'FECHA_CATEDRA') return 110;
  if (c === 'CÓDIGO_ESTUDIANTE' || c === 'CODIGO_ESTUDIANTE') return 130;
  if (c === 'NOMBRE_ESTUDIANTE') return 200;
  if (c === 'CORREO') return 190;
  if (c === 'CORTE') return 60;
  if (c === 'OBSERVACIONES') return 140;
  return 120;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: '#fff',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 999,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle: { fontWeight: '900', color: '#111827', fontSize: 15 },
  headerSub: { marginTop: 3, fontSize: 12, color: '#6B7280' },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  errorText: { color: '#B91C1C', textAlign: 'center', fontWeight: '700', marginBottom: 16 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
  },
  retryBtnText: { color: '#fff', fontWeight: '800' },
  emptyText: { color: '#9CA3AF', fontSize: 15 },
  // Metadatos
  metaCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  metaTitle: { fontWeight: '900', color: '#374151', marginBottom: 10, fontSize: 13 },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  metaKey: { color: '#6B7280', fontSize: 12, flex: 1 },
  metaVal: { color: '#111827', fontWeight: '700', fontSize: 12, flex: 1, textAlign: 'right' },
  // Tabla
  tableWrap: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  tableTitle: {
    fontWeight: '900', color: '#374151', fontSize: 13,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  theadRow: { flexDirection: 'row', backgroundColor: '#1F2937' },
  th: {
    paddingVertical: 9, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: '#374151',
  },
  thText: { fontSize: 10, color: '#F9FAFB', fontWeight: '900', textTransform: 'uppercase' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  trAlt: { backgroundColor: '#FAFAFA' },
  td: {
    paddingVertical: 8, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: '#F3F4F6',
    justifyContent: 'center',
    borderWidth: 0,
  },
  tdText: { fontSize: 11, color: '#374151' },
  // Leyenda
  legend: {
    flexDirection: 'row', gap: 16, paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FAFAFA',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  legendText: { fontSize: 11, color: '#6B7280' },
  // Descarga
  downloadSection: {
    marginTop: 24, paddingHorizontal: 16,
  },
  downloadHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
  },
  downloadHeaderLine: {
    flex: 1, height: 1, backgroundColor: '#E5E7EB',
  },
  downloadHeaderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14,
  },
  downloadTitle: {
    fontWeight: '900', color: '#6B7280', fontSize: 11, letterSpacing: 1,
  },
  downloadBtns: {
    flexDirection: 'row', gap: 8, justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  dlBtn: {
    flex: 1, paddingVertical: 24, paddingHorizontal: 2,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  dlBtnPressed: { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB', transform: [{ scale: 0.96 }] },
  dlBtnIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  dlBtnText: { color: '#111827', fontWeight: '900', fontSize: 15, textAlign: 'center' },
  dlBtnSub: { color: '#6B7280', fontSize: 11, marginTop: 4, textAlign: 'center' },
});

// ─── Helpers para anchos de columna en previews ─────
function xColW(col) {
  const c = String(col).toUpperCase();
  if (c === '#') return 28; if (['SI', 'NO'].includes(c)) return 34;
  if (c === 'RETARDO') return 58; if (c === 'NOMBRE_ESTUDIANTE') return 140;
  if (c.includes('CÓDIGO') || c.includes('CODIGO')) return 100;
  return 76;
}
function xCellBg(col, val) {
  const c = String(col).toUpperCase(); const v = String(val).toUpperCase();
  if (c === 'SI' && v === 'X') return '#C6EFCE';
  if (c === 'NO' && v === 'X') return '#FFC7CE';
  if (c === 'RETARDO' && v === 'X') return '#FFEB9C';
  return null;
}
function pColW(col) {
  const c = String(col).toUpperCase();
  if (c === '#') return 24; if (['SI', 'NO'].includes(c)) return 28;
  if (c === 'RETARDO') return 52; if (c === 'NOMBRE_ESTUDIANTE') return 120;
  if (c.includes('CÓDIGO') || c.includes('CODIGO')) return 86;
  return 68;
}

// ─── Estilos del modal de previsualización ──────────
const mp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  sheetTitle: { fontWeight: '900', color: '#111827', fontSize: 16 },
  closeBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  actionArea: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', zIndex: 10 },
  downloadConfirm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  downloadConfirmText: { color: '#ffffff', fontWeight: '900', fontSize: 18 },
  // CSV
  csvBox: { backgroundColor: '#1E1E1E', padding: 14, minHeight: 200 },
  csvBadge: { color: '#6EE7B7', fontSize: 10, fontWeight: '700', marginBottom: 8, fontFamily: 'monospace' },
  csvLine: { color: '#D4D4D4', fontSize: 10, fontFamily: 'monospace', lineHeight: 16 },
  // Excel
  xlsxBox: { backgroundColor: '#fff', minHeight: 200 },
  xlsxBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#217346', paddingHorizontal: 12, paddingVertical: 8 },
  xlsxBarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  xlsxBarDot: { color: '#A5D6A7', fontSize: 10 },
  xlsxHead: { flexDirection: 'row', backgroundColor: '#4472C4' },
  xlsxTh: { paddingVertical: 8, paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: '#335C9E' },
  xlsxThText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  xlsxTr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#D9D9D9', backgroundColor: '#fff' },
  xlsxTd: { paddingVertical: 6, paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: '#D9D9D9' },
  xlsxTdText: { fontSize: 10, color: '#212121' },
  xlsxMore: { padding: 8, color: '#9CA3AF', fontSize: 10, textAlign: 'center', backgroundColor: '#F9FAFB' },
  // PDF
  pdfPage: { backgroundColor: '#fff', padding: 16, minHeight: 200 },
  pdfHeader: { alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: '#1F2937', marginBottom: 8 },
  pdfHeaderTitle: { fontWeight: '900', color: '#1F2937', fontSize: 13 },
  pdfHeaderSub: { color: '#4B5563', fontSize: 10, marginTop: 2 },
  pdfMetaRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  pdfMetaKey: { fontSize: 10, color: '#6B7280', width: 110 },
  pdfMetaVal: { fontSize: 10, color: '#111827', fontWeight: '700', flex: 1 },
  pdfThead: { flexDirection: 'row', backgroundColor: '#1F2937' },
  pdfTh: { paddingVertical: 6, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: '#374151' },
  pdfThText: { fontSize: 9, color: '#F9FAFB', fontWeight: '900' },
  pdfTr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  pdfTd: { paddingVertical: 5, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: '#E5E7EB' },
  pdfTdText: { fontSize: 9, color: '#374151' },
  pdfMore: { padding: 6, color: '#9CA3AF', fontSize: 9, textAlign: 'center' },
  pdfFoot: { marginTop: 12, color: '#9CA3AF', fontSize: 8, textAlign: 'center', fontStyle: 'italic', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 6 },
});
