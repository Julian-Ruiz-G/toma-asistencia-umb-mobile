import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import { ATTENDANCE_REPORT_URL } from '../config';

function ensureApi() {
  if (!ATTENDANCE_REPORT_URL) {
    throw new Error('API no configurada (revisa app.json → extra.apiUrl)');
  }
}

/**
 * Descarga el CSV oficial del backend (/attendance-report).
 */
export async function fetchAttendanceReportCsv(authToken, sessionId, corte) {
  ensureApi();
  const sid = String(sessionId || '').trim();
  if (!sid) {
    throw new Error('Falta el identificador de sesión');
  }
  if (!authToken) {
    throw new Error('No hay sesión de docente activa');
  }

  const resp = await fetch(ATTENDANCE_REPORT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      sessionId: sid,
      ...(corte ? { corte: String(corte).trim() } : {}),
    }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.error || j.message || j.details || msg;
    } catch {
      // keep text
    }
    throw new Error(typeof msg === 'string' ? msg : `HTTP ${resp.status}`);
  }
  return text;
}

export async function shareLocalFile(uri, mimeType) {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Compartir archivos no está disponible en este dispositivo');
  }
  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: 'Exportar informe',
  });
}

/**
 * @param {'csv' | 'xlsx' | 'pdf'} format
 */
export async function exportAttendanceReport(authToken, sessionId, format, options = {}) {
  const { corte } = options;
  const csvText = await fetchAttendanceReportCsv(authToken, sessionId, corte);
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error(
      'No hay carpeta de archivos disponible. Si usas Expo en web, prueba en Android o iOS. Si el error continúa, reinstala la app o usa Expo Go actualizado.'
    );
  }

  const safeSession = String(sessionId || 'sesion').replace(/[^a-zA-Z0-9_-]/g, '_');

  if (format === 'csv') {
    const name = `reporte_asistencia_${safeSession}.csv`;
    const uri = `${baseDir}${name}`;
    await FileSystem.writeAsStringAsync(uri, csvText, { encoding: FileSystem.EncodingType.UTF8 });
    await shareLocalFile(uri, 'text/csv');
    return uri;
  }

  const wb = XLSX.read(csvText, { type: 'string', raw: true });
  const sheetName = wb.SheetNames[0] || 'Reporte';
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error('No se pudo leer el contenido del informe');
  }

  if (format === 'xlsx') {
    const name = `reporte_asistencia_${safeSession}.xlsx`;
    const uri = `${baseDir}${name}`;
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    await FileSystem.writeAsStringAsync(uri, wbout, { encoding: FileSystem.EncodingType.Base64 });
    await shareLocalFile(
      uri,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    return uri;
  }

  if (format === 'pdf') {
    const tableHtml = XLSX.utils.sheet_to_html(ws, { editable: false });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; color: #111; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { border: 1px solid #ccc; padding: 3px 4px; word-wrap: break-word; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 700; }
</style></head><body>${tableHtml}</body></html>`;

    const { uri } = await Print.printToFileAsync({ html });
    await shareLocalFile(uri, 'application/pdf');
    return uri;
  }

  throw new Error('Formato no soportado');
}
