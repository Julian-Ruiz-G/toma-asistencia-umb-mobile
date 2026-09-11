import React from 'react';
import { Shield } from 'lucide-react-native';

import LegalDocumentModal from './LegalDocumentModal';

const BIOMETRIC_MARKDOWN = `
# Autorización de tratamiento de datos biométricos

> Consentimiento específico para el reconocimiento facial en el sistema de asistencia académica.

- **Versión:** 1.0
- **Fecha de vigencia:** 10 de agosto de 2026
- **Responsable:** Universidad Manuela Beltrán

## Información importante

He sido informado(a) de que los datos biométricos son considerados **datos personales sensibles** bajo la legislación colombiana (**Ley 1581 de 2012**).

## ¿Qué son los datos biométricos?

Los datos biométricos son características físicas o de comportamiento que pueden usarse para identificar a una persona. En este sistema se trata de:

- Imágenes faciales.
- Características biométricas derivadas de esas imágenes.
- Plantillas o representaciones biométricas.

## Finalidad del tratamiento

Mis datos biométricos serán utilizados **exclusivamente** para:

- Verificar mi identidad durante el registro de asistencia académica.
- Validar que soy quien digo ser al marcar asistencia.
- Prevenir la suplantación de identidad en el sistema de asistencia.

## No estoy obligado(a) a autorizar

Entiendo que:

- No estoy obligado(a) a autorizar el tratamiento de mis datos biométricos.
- La negativa a autorizar no será utilizada, por sí sola, para restringir mis derechos fundamentales.
- Pueden existir mecanismos alternativos de identificación, según la configuración institucional.

## Mecanismos alternativos

Si no autorizo el tratamiento de mis datos biométricos, podré, cuando estén disponibles:

- Usar códigos QR u otros identificadores visuales para marcar asistencia.
- Utilizar otros mecanismos de identificación habilitados por la institución.

## Consecuencias de no autorizar

Si no autorizo el tratamiento de datos biométricos:

- No podré usar el reconocimiento facial para marcar asistencia.
- Podré seguir usando el sistema mediante los métodos alternativos habilitados.
- Mi asistencia podrá seguir registrándose por esos mecanismos, cuando correspondan.

## Derechos como titular

Tengo derecho a:

- Conocer qué datos biométricos están siendo tratados.
- Solicitar la actualización o corrección de mis datos.
- Solicitar la supresión de mis datos biométricos cuando legalmente proceda.
- Presentar consultas y reclamos sobre el tratamiento.
- Revocar esta autorización cuando sea legalmente procedente.

## Conservación de los datos

Los datos biométricos se conservarán únicamente durante el tiempo necesario para cumplir las finalidades informadas y durante los periodos exigibles por obligaciones legales o académicas. **No se conservarán de forma indefinida.**

## Contacto

- **Correo:** protecciondatos@umb.edu.co
- **Dirección:** Calle 73 # 73-33, Bogotá D.C., Colombia
- **Teléfono:** +57 601 668 3600

---

## Declaración de autorización

Declaro que he sido informado(a) claramente sobre:

- Que se trata de datos biométricos (datos sensibles).
- La finalidad específica del tratamiento.
- Que no estoy obligado(a) a autorizar su tratamiento.
- Las consecuencias de no otorgar la autorización.
- Los mecanismos alternativos disponibles, cuando existan.
- Mis derechos como titular de datos.

Al pulsar el botón de aceptación, **autorizo expresamente** el tratamiento de mis datos biométricos para la verificación de identidad y el registro de asistencia académica.

- **Medio de autorización:** Aplicación móvil UMB
- **Mecanismo de aceptación:** Aceptación digital mediante botón en la aplicación
`;

export default function BiometricConsentModal({ visible, onClose, onAccept, readOnly = false }) {
  return (
    <LegalDocumentModal
      visible={visible}
      onClose={onClose}
      onAccept={onAccept}
      hideAccept={readOnly}
      title="Autorización de datos biométricos"
      accent="#7C3AED"
      Icon={Shield}
      markdown={BIOMETRIC_MARKDOWN}
      acceptLabel="Autorizo el tratamiento biométrico"
    />
  );
}
