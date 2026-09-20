import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';
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
  const showFooter = !hideAccept && !!onAccept;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.header, { backgroundColor: accent, paddingTop: Math.max(insets.top, 16) + 8 }]}>
            <Pressable onPress={onClose} style={styles.headerIconBtn} hitSlop={8}>
              <ArrowLeft size={20} color="#fff" />
            </Pressable>
            <View style={styles.headerContent}>
              {Icon ? <Icon size={18} color="#fff" /> : null}
              <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.headerIconBtn} hitSlop={8}>
              <X size={18} color="#fff" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingBottom: showFooter ? 28 : 24 + insets.bottom },
            ]}
            showsVerticalScrollIndicator
          >
            <LegalMarkdown content={markdown} />
          </ScrollView>

          {showFooter ? (
            <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
              <Pressable onPress={onAccept} style={[styles.acceptBtn, { backgroundColor: accent }]}>
                <Text style={styles.acceptBtnText}>{acceptLabel}</Text>
              </Pressable>
            </View>
          ) : null}
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
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
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
});
