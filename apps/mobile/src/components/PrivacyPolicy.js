import React from 'react';
import { Shield } from 'lucide-react-native';

import LegalDocumentModal from './LegalDocumentModal';

const PRIVACY_MARKDOWN = `
# Política de Privacidad y Tratamiento de Datos Personales

> Sistema de control de asistencia académica mediante identificadores visuales y reconocimiento facial.

- **Versión:** 1.0
- **Fecha de vigencia:** 10 de agosto de 2026
- **Responsable del tratamiento:** Universidad Manuela Beltrán
- **Correo de protección de datos:** protecciondatos@umb.edu.co
- **Domicilio:** Bogotá D.C., Colombia

## 1. Introducción

La presente Política establece los criterios mediante los cuales la Universidad Manuela Beltrán recolecta, almacena, utiliza, consulta, organiza, conserva y, cuando corresponda, elimina los datos personales tratados mediante el sistema de control de asistencia académica.

Esta política se desarrolla de conformidad con el régimen colombiano de protección de datos personales, particularmente la **Ley 1581 de 2012** y sus normas reglamentarias y complementarias.

## 2. Responsable del tratamiento

- **Nombre o razón social:** Universidad Manuela Beltrán
- **NIT:** 860.007.375-9
- **Dirección:** Calle 73 # 73-33, Bogotá D.C., Colombia
- **Correo electrónico:** protecciondatos@umb.edu.co
- **Teléfono:** +57 601 668 3600

## 3. Datos personales tratados

Dependiendo de las funcionalidades utilizadas, el sistema podrá tratar las siguientes categorías de información.

### 3.1 Datos de identificación

- Nombres y apellidos.
- Número o código institucional.
- Identificador del usuario.
- Información necesaria para identificar al estudiante o docente.

### 3.2 Datos de contacto

Cuando sean necesarios:

- Correo electrónico.
- Número telefónico.
- Otros datos de contacto institucionales.

### 3.3 Datos académicos

- Programa académico.
- Asignatura, grupo, jornada o curso.
- Rol dentro de la plataforma.
- Registros de asistencia.

### 3.4 Datos tecnológicos

El sistema podrá registrar información técnica necesaria para su funcionamiento y seguridad, como:

- Fecha y hora de acceso.
- Registros de actividad.
- Información relacionada con errores técnicos.
- Identificadores técnicos necesarios para seguridad y auditoría.

### 3.5 Datos biométricos

Cuando esté habilitada la funcionalidad de reconocimiento facial, podrán tratarse imágenes faciales y características biométricas utilizadas para verificar la identidad del usuario.

Los datos biométricos son considerados **datos sensibles** en Colombia. El usuario será informado previamente de su naturaleza y de que **no está obligado a autorizar su tratamiento**.

## 4. Finalidades del tratamiento

Los datos personales serán tratados únicamente para finalidades legítimas, determinadas, explícitas e informadas al titular:

1. Registrar la asistencia a actividades académicas.
2. Verificar la identidad del usuario cuando corresponda.
3. Permitir el funcionamiento de la plataforma.
4. Administrar usuarios y permisos de acceso.
5. Consultar y generar reportes de asistencia.
6. Detectar inconsistencias o posibles intentos de suplantación.
7. Mantener la seguridad de la plataforma.
8. Realizar auditorías técnicas y de seguridad.
9. Atender solicitudes, consultas, reclamos y requerimientos relacionados con los datos personales.
10. Cumplir obligaciones legales o requerimientos de autoridades competentes cuando corresponda.
11. Realizar actividades académicas, de investigación o evaluación del proyecto cuando exista una base jurídica y autorización que lo permita.

Los datos no serán utilizados para finalidades incompatibles con aquellas informadas al titular.

## 5. Tratamiento de datos biométricos

El reconocimiento facial constituye un tratamiento de datos biométricos y, por tanto, de información sensible.

Antes de realizar dicho tratamiento, el sistema informará claramente:

- Que se están tratando datos biométricos.
- La finalidad específica del tratamiento.
- El carácter sensible de la información.
- Que el titular no está obligado a autorizar dicho tratamiento.
- Las consecuencias, cuando existan, de no otorgar la autorización.
- Los mecanismos alternativos disponibles, cuando correspondan.
- Los derechos que puede ejercer el titular.

La autorización para el tratamiento de datos biométricos deberá ser **independiente, expresa, previa e informada**.

La aceptación general de los Términos y Condiciones **no** se interpreta automáticamente como autorización para el tratamiento de datos biométricos.

## 6. Mecanismo alternativo de identificación

Cuando el sistema requiera una alternativa al reconocimiento facial, podrá utilizar mecanismos menos invasivos, como identificadores visuales, códigos u otros mecanismos tecnológicos autorizados.

La finalidad de estos mecanismos es permitir la validación de asistencia sin que necesariamente se requiera el tratamiento de información biométrica.

La disponibilidad concreta de los mecanismos alternativos dependerá de la configuración institucional del sistema.

## 7. Autorización del titular

La autorización deberá permitir demostrar que el titular fue informado sobre:

- Qué información será tratada.
- Para qué será utilizada.
- Quién es el responsable.
- Los derechos que puede ejercer.
- Los mecanismos para presentar consultas o reclamos.

En el caso de datos sensibles, la autorización deberá ser expresa y específica. El responsable conservará evidencia de las autorizaciones obtenidas.

## 8. Derechos de los titulares

De acuerdo con la legislación colombiana, los titulares podrán:

1. Conocer los datos personales que están siendo tratados.
2. Solicitar la actualización de sus datos.
3. Solicitar la rectificación de información incorrecta, incompleta o inexacta.
4. Solicitar prueba de la autorización otorgada cuando corresponda.
5. Ser informados sobre el uso que se ha dado a sus datos.
6. Presentar consultas y reclamos.
7. Solicitar la revocatoria de la autorización cuando sea procedente.
8. Solicitar la supresión de sus datos cuando legalmente proceda.
9. Presentar quejas ante la Superintendencia de Industria y Comercio.
10. Acceder gratuitamente a sus datos personales tratados, en los términos legales.

## 9. Derechos respecto de datos sensibles

El titular tiene derecho a decidir libremente si autoriza el tratamiento de sus datos sensibles.

En particular, la negativa a suministrar datos biométricos deberá ser respetada.

Cuando exista una alternativa razonable y técnicamente disponible, el sistema deberá permitir mecanismos que no requieran datos biométricos.

## 10. Consultas y reclamos

Los titulares podrán presentar consultas o reclamos mediante:

- **Correo electrónico:** protecciondatos@umb.edu.co

Las solicitudes deberán permitir identificar al titular y especificar claramente lo pedido. El responsable dará respuesta dentro de los términos establecidos por la legislación colombiana.

## 11. Revocatoria de la autorización

El titular podrá solicitar la revocatoria de la autorización cuando legalmente proceda. La revocatoria podrá afectar funcionalidades que dependan del tratamiento autorizado.

Cuando se trate de datos biométricos, la revocatoria se atenderá de acuerdo con las reglas aplicables a los datos sensibles.

La solicitud de revocatoria no procederá cuando exista una obligación legal o contractual que permita mantener el tratamiento.

## 12. Supresión de los datos

El titular podrá solicitar la supresión de sus datos personales cuando legalmente proceda.

La eliminación estará sujeta a las obligaciones legales, académicas, administrativas o contractuales que puedan exigir la conservación de determinada información.

Una vez desaparezca la finalidad del tratamiento y no exista obligación de conservación, los datos deberán ser eliminados, anonimizados o sometidos a una medida equivalente.

## 13. Conservación de la información

Los datos personales se conservarán únicamente durante el tiempo necesario para cumplir las finalidades para las cuales fueron recolectados y durante los periodos exigibles por obligaciones legales, académicas o administrativas.

El responsable establecerá internamente un periodo o criterio de conservación para:

- Datos de usuarios.
- Registros de asistencia.
- Imágenes utilizadas para identificación.
- Plantillas o representaciones biométricas, si existen.
- Registros de auditoría.
- Evidencias de autorización.

Los datos biométricos **no** deberán conservarse indefinidamente.

## 14. Tratamiento de imágenes faciales

Las imágenes utilizadas para reconocimiento facial serán tratadas exclusivamente para las finalidades informadas y autorizadas.

Cuando sea técnicamente posible, el sistema evitará conservar imágenes originales durante más tiempo del estrictamente necesario.

Cuando el reconocimiento facial permita trabajar con representaciones o plantillas biométricas, estas recibirán las mismas medidas de protección aplicables a los datos sensibles.

## 15. Seguridad de la información

El responsable adoptará medidas de seguridad razonables y apropiadas, que podrán incluir:

- Control de acceso y autenticación.
- Gestión de roles y permisos.
- Cifrado de información cuando corresponda.
- Protección de credenciales.
- Copias de seguridad controladas.
- Registro de actividades.
- Restricción de acceso a datos biométricos.
- Medidas contra accesos no autorizados.
- Gestión de vulnerabilidades.
- Procedimientos de respuesta ante incidentes de seguridad.

El acceso a los datos se limitará al personal que realmente los necesite para cumplir sus funciones.

## 16. Confidencialidad

Las personas que intervengan en el tratamiento de datos personales deberán mantener la confidencialidad de la información, incluso después de finalizar su relación con el responsable o encargado, cuando así corresponda legalmente.

## 17. Encargados y proveedores tecnológicos

Cuando terceros presten servicios de almacenamiento, procesamiento, alojamiento, infraestructura, mantenimiento o soporte, el responsable determinará las condiciones bajo las cuales dichos terceros actuarán como encargados del tratamiento, cuando corresponda.

Los encargados únicamente podrán tratar la información conforme a las instrucciones, finalidades y condiciones establecidas por el responsable y la ley.

## 18. Transferencias y transmisiones internacionales

Cuando los datos se almacenen o traten mediante proveedores ubicados fuera de Colombia, el responsable evaluará y cumplirá las reglas colombianas aplicables a las transferencias o transmisiones internacionales, e implementará las garantías contractuales, técnicas y organizativas correspondientes.

## 19. Datos de niños, niñas y adolescentes

El sistema evitará la recolección de datos de niños, niñas y adolescentes salvo que exista una base jurídica que permita el tratamiento y se cumplan las condiciones especiales previstas por la legislación colombiana.

Cuando corresponda tratar información de menores de edad, deberá garantizarse la protección reforzada de sus derechos y prevalecer el interés superior del menor.

## 20. Cookies y tecnologías similares

Si la plataforma utiliza cookies, almacenamiento local u otras tecnologías similares, estas se usarán únicamente para finalidades informadas al usuario, como autenticación, seguridad, funcionamiento y mejora técnica del servicio.

Las cookies que no sean estrictamente necesarias se gestionarán de acuerdo con las opciones y obligaciones legales aplicables.

## 21. Incidentes de seguridad

Ante un incidente que pueda comprometer datos personales, el responsable activará los procedimientos internos para:

1. Identificar el incidente.
2. Contenerlo.
3. Evaluar los datos afectados.
4. Determinar los titulares potencialmente afectados.
5. Adoptar medidas de mitigación.
6. Documentar el incidente.
7. Realizar las comunicaciones que legalmente correspondan.

## 22. Principios aplicables

El tratamiento de datos personales respetará, entre otros, los principios de:

- Legalidad.
- Finalidad.
- Libertad.
- Veracidad o calidad.
- Transparencia.
- Acceso y circulación restringida.
- Seguridad.
- Confidencialidad.

## 23. Cambios en la política

Esta Política podrá actualizarse cuando existan modificaciones legales, tecnológicas, administrativas o en las finalidades del tratamiento.

Las modificaciones relevantes se comunicarán a los titulares mediante mecanismos apropiados. La versión vigente estará disponible para consulta.

## 24. Vigencia

La presente Política entra en vigencia a partir del **10 de agosto de 2026** y permanecerá vigente mientras se realice tratamiento de datos personales por parte del responsable, sin perjuicio de las actualizaciones posteriores.

## 25. Contacto

Para ejercer derechos, consultas o reclamos:

- **Responsable:** Universidad Manuela Beltrán
- **Correo:** protecciondatos@umb.edu.co
- **Dirección:** Calle 73 # 73-33, Bogotá D.C., Colombia
- **Teléfono:** +57 601 668 3600

---

## Autorización para el tratamiento de datos personales

Declaro que he leído esta Política de Privacidad y Tratamiento de Datos Personales y que he sido informado(a) sobre las finalidades para las cuales serán tratados mis datos personales.

Al pulsar el botón de aceptación, **autorizo** el tratamiento de mis datos personales de acuerdo con esta Política.
`;

export default function PrivacyPolicyModal({ visible, onClose, onAccept, readOnly = false }) {
  return (
    <LegalDocumentModal
      visible={visible}
      onClose={onClose}
      onAccept={onAccept}
      hideAccept={readOnly}
      title="Política de Privacidad"
      accent="#059669"
      Icon={Shield}
      markdown={PRIVACY_MARKDOWN}
      acceptLabel="Acepto la Política de Privacidad"
    />
  );
}
