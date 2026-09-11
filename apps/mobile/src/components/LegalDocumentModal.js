import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LegalMarkdown from './LegalMarkdown';

export default function LegalDocumentModal({
  visible,
  onClose,
  onAccept,
  title,
  accent = '#1E40AF',
  Icon,
  markdown,
  acceptLabel,
  hideAccept = false,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.header, { backgroundColor: accent }]}>
            <Pressable onPress={onClose} style={styles.backBtn} hitSlop={8}>
              <ArrowLeft size={20} color="#fff" />
            </Pressable>
            <View style={styles.headerContent}>
              {Icon ? <Icon size={20} color="#fff" /> : null}
              <Text style={styles.headerTitle}>{title}</Text>
            </View>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator
          >
            <LegalMarkdown content={markdown} />
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
            {!hideAccept && onAccept ? (
              <Pressable onPress={onAccept} style={[styles.acceptBtn, { backgroundColor: accent }]}>
                <Text style={styles.acceptBtnText}>{acceptLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>{hideAccept ? 'Cerrar' : 'Cerrar'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
    backgroundColor: '#fff',
  },
  acceptBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  closeBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
});
