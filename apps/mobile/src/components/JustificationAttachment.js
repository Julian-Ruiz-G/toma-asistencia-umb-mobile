import React, { useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ExternalLink, FileText, Image as ImageIcon } from 'lucide-react-native';

import { useColors } from '../ui/ThemeContext';
import { appAlert } from '../ui/appNotice';

const KIND_LABEL = {
  pdf: 'PDF',
  doc: 'Word',
  docx: 'Word',
  jpg: 'Foto',
  png: 'Foto',
  webp: 'Foto',
  heic: 'Foto',
};

function fileUrl(row) {
  return row?.fileUrl || row?.photoUrl || '';
}

function isImage(row) {
  const type = String(row?.contentType || '');
  if (type) return type.startsWith('image/');
  return Boolean(row?.photoUrl);
}

/**
 * Soporte adjunto a una justificación: vista previa si es foto y botón para abrirlo
 * (PDF, Word o imagen) con la app del teléfono. La URL es temporal (10 min).
 */
export default function JustificationAttachment({ row, onExpired }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [previewFailed, setPreviewFailed] = useState(false);
  const url = fileUrl(row);

  if (!row?.hasFile) return null;
  if (!url) {
    return <Text style={styles.muted}>El soporte está guardado, pero no se puede abrir en este momento.</Text>;
  }

  const image = isImage(row);
  const kind = KIND_LABEL[String(row?.fileType || '').toLowerCase()] || (image ? 'Foto' : 'Archivo');
  const name = row?.fileName || `Soporte (${kind})`;

  const open = async () => {
    try {
      await Linking.openURL(url);
    } catch {
      appAlert(
        'No se pudo abrir el soporte',
        kind === 'Word'
          ? 'Instala una app que abra documentos de Word (por ejemplo, Word o Google Docs) e inténtalo otra vez.'
          : 'Actualiza la lista e inténtalo otra vez.'
      );
      onExpired?.();
    }
  };

  const Icon = image ? ImageIcon : FileText;

  return (
    <View style={styles.wrap}>
      {image && !previewFailed ? (
        <Pressable onPress={open} accessibilityLabel="Abrir foto del soporte">
          <Image
            source={{ uri: url }}
            style={styles.photo}
            resizeMode="cover"
            onError={() => setPreviewFailed(true)}
          />
        </Pressable>
      ) : null}
      <Pressable onPress={open} style={styles.fileBtn} accessibilityRole="button">
        <View style={styles.fileIcon}>
          <Icon size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
          <Text style={styles.fileHint}>{`${kind} · Toca para abrir`}</Text>
        </View>
        <ExternalLink size={16} color={COLORS.primary} />
      </Pressable>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  wrap: { marginTop: 12, gap: 8 },
  photo: { width: '100%', height: 200, borderRadius: 12, backgroundColor: COLORS.surface },
  fileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder || COLORS.border,
    backgroundColor: COLORS.primarySoft,
  },
  fileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  fileName: { fontWeight: '800', color: COLORS.text },
  fileHint: { marginTop: 2, color: COLORS.textSecondary, fontSize: 12 },
  muted: { marginTop: 10, color: COLORS.textSecondary, fontWeight: '700' },
});
