import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Shield } from 'lucide-react-native';

const BIOMETRIC_CONSENT_TEXT = `
# CONSENTIMIENTO PARA EL TRATAMIENTO DE DATOS BIOMÉTRICOS

**Sistema de control de asistencia académica mediante reconocimiento facial**

**Versión:** 1.0
**Fecha de entrada en vigencia:** 10 de agosto de 2026
**Responsable:** Universidad Manuela Beltrán

## Información Importante

He sido informado(a) de que los datos biométricos son considerados **datos personales sensibles** bajo la legislación colombiana (Ley 1581 de 2012).

## ¿Qué son los datos biométricos?

Los datos biométricos son características físicas o de comportamiento que pueden usarse para identificar a una persona. En este sistema, se trata de:

* Imágenes faciales
* Características biométricas derivadas de las imágenes faciales
* Plantillas o representaciones biométricas

## Finalidad del tratamiento

Mis datos biométricos serán utilizados exclusivamente para:

* Verificar mi identidad durante el registro de asistencia académica
* Validar que soy quien digo ser al marcar asistencia
* Prevenir suplantación de identidad en el sistema de asistencia

## No estoy obligado(a) a autorizar

**Entiendo que:**

* No estoy obligado(a) a autorizar el tratamiento de mis datos biométricos
* La negativa a autorizar no será utilizada como fundamento para restringir mis derechos fundamentales
* Existen mecanismos alternativos de identificación (como códigos QR) que no requieren datos biométricos

## Mecanismos alternativos

Si no autorizo el tratamiento de mis datos biométricos, puedo:

* Usar códigos QR para marcar asistencia
* Utilizar otros mecanismos de identificación disponibles en el sistema

## Consecuencias de no autorizar

Si no autorizo el tratamiento de datos biométricos:

* No podré usar el reconocimiento facial para marcar asistencia
* Podré seguir usando el sistema mediante códigos QR u otros métodos alternativos
* Mi asistencia seguirá siendo registrada correctamente

## Derechos como titular de datos

Tengo derecho a:

* Conocer qué datos biométricos están siendo tratados
* Solicitar la actualización o corrección de mis datos
* Solicitar la supresión de mis datos biométricos cuando legalmente proceda
* Presentar consultas y reclamos sobre el tratamiento
* Revocar esta autorización en cualquier momento

## Conservación de los datos

Los datos biométricos se conservarán únicamente durante el tiempo necesario para cumplir las finalidades informadas y durante los periodos exigibles por obligaciones legales o académicas.

## Contacto

Para consultas sobre el tratamiento de mis datos biométricos:

**Correo:** protecciondatos@umb.edu.co
**Dirección:** Calle 73 # 73-33, Bogotá D.C., Colombia
**Teléfono:** +57 601 668 3600

---

### AUTORIZACIÓN

Declaro que he sido informado(a) claramente sobre:

* Que se trata de datos biométricos (datos sensibles)
* La finalidad específica del tratamiento
* Que no estoy obligado(a) a autorizar su tratamiento
* Las consecuencias de no otorgar la autorización
* Los mecanismos alternativos disponibles
* Mis derechos como titular de datos

☐ **Autorizo expresamente** el tratamiento de mis datos biométricos para la finalidad de verificación de identidad y registro de asistencia académica.

☐ **No autorizo** el tratamiento de mis datos biométricos.

**Medio de autorización:** Aplicación móvil UMB
**Firma o mecanismo de aceptación:** Aceptación digital mediante botón en aplicación
`;

export default function BiometricConsentModal({ visible, onClose, onAccept }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.backBtn}>
              <ArrowLeft size={20} color="#fff" />
            </Pressable>
            <View style={styles.headerContent}>
              <Shield size={20} color="#fff" />
              <Text style={styles.headerTitle}>Consentimiento Biométrico</Text>
            </View>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.text}>{BIOMETRIC_CONSENT_TEXT}</Text>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onAccept} style={styles.acceptBtn}>
              <Text style={styles.acceptBtnText}>Acepto Datos Biométricos</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
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
    backgroundColor: '#7C3AED',
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
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  text: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
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
