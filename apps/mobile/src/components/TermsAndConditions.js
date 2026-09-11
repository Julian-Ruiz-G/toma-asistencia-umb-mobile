import React from 'react';
import { FileText } from 'lucide-react-native';

import LegalDocumentModal from './LegalDocumentModal';

const TERMS_MARKDOWN = `
# Términos y Condiciones de Uso

> Sistema de control de asistencia académica mediante identificadores visuales y reconocimiento facial.

- **Versión:** 1.0
- **Fecha de vigencia:** 10 de agosto de 2026
- **Responsable:** Universidad Manuela Beltrán
- **Domicilio:** Bogotá D.C., Colombia
- **Contacto:** soporte@umb.edu.co

## 1. Objeto

Los presentes Términos y Condiciones regulan el acceso, registro y utilización del sistema de control de asistencia académica mediante identificadores visuales y mecanismos de validación de identidad, incluido el reconocimiento facial cuando dicha funcionalidad se encuentre habilitada.

El sistema tiene como finalidad apoyar los procesos académicos relacionados con el registro, consulta, validación y seguimiento de la asistencia de estudiantes y docentes.

El uso de la plataforma implica la aceptación de estos Términos y Condiciones.

## 2. Usuarios autorizados

El sistema está dirigido exclusivamente a usuarios autorizados por la institución educativa o por el administrador del sistema, incluyendo, según corresponda:

- Estudiantes.
- Docentes.
- Personal administrativo autorizado.
- Administradores del sistema.

Cada usuario es responsable de utilizar únicamente las funcionalidades y la información a las que tenga autorización de acceso.

## 3. Registro y autenticación

Para utilizar determinadas funcionalidades, el usuario podrá proporcionar información como:

- Nombres y apellidos.
- Número o código institucional.
- Correo electrónico institucional.
- Información académica necesaria para identificar la asignatura o grupo.
- Información relacionada con los registros de asistencia.
- Identificadores visuales utilizados por el sistema.

El usuario se compromete a proporcionar información **verdadera, completa y actualizada**. No está permitido utilizar las credenciales, identificadores o mecanismos de autenticación pertenecientes a otra persona.

## 4. Registro de asistencia

El sistema permite registrar y validar la asistencia mediante mecanismos tecnológicos autorizados por la institución, incluyendo identificadores visuales y, cuando corresponda, reconocimiento facial.

Los registros de asistencia deberán utilizarse exclusivamente para las finalidades académicas y administrativas autorizadas.

El sistema no garantiza que una validación tecnológica sea infalible. En caso de errores de identificación, fallos técnicos o inconsistencias, el usuario podrá solicitar la revisión por los canales institucionales establecidos.

## 5. Reconocimiento facial y datos biométricos

Cuando el sistema utilice reconocimiento facial, el usuario será informado previamente de que dicha funcionalidad implica el tratamiento de **información biométrica**.

Los datos biométricos son considerados **datos personales sensibles** bajo la legislación colombiana. Por esta razón, su tratamiento estará sujeto a una autorización previa, expresa, informada y específica del titular.

El suministro de datos biométricos no deberá entenderse como una obligación general del usuario. Cuando sea técnica y operativamente posible, deberán existir mecanismos alternativos de identificación que no impliquen el tratamiento de datos biométricos.

La negativa a autorizar el tratamiento de datos biométricos no deberá utilizarse, por sí sola, como fundamento para restringir derechos fundamentales.

## 6. Uso adecuado de la plataforma

El usuario se compromete a:

1. Utilizar el sistema exclusivamente para fines académicos y autorizados.
2. No intentar acceder a cuentas o información de otros usuarios.
3. No manipular, alterar o eliminar registros de asistencia sin autorización.
4. No compartir credenciales de acceso.
5. No intentar vulnerar los mecanismos de seguridad.
6. No utilizar fotografías, códigos o identificadores de otra persona para registrar asistencia.
7. No realizar actividades que puedan afectar el funcionamiento del sistema.
8. Informar oportunamente cualquier vulnerabilidad, error o acceso no autorizado que detecte.

## 7. Prohibición de suplantación

Está prohibido utilizar mecanismos tecnológicos, fotografías, videos, códigos, credenciales u otros medios para registrar fraudulentamente la asistencia de otra persona.

La utilización del sistema para realizar suplantación de identidad o alterar deliberadamente registros podrá dar lugar a las medidas académicas, administrativas o legales que correspondan.

## 8. Información y registros académicos

Los registros generados mediante el sistema deberán utilizarse únicamente para las finalidades previamente informadas al titular.

El acceso a dichos registros estará limitado a las personas que tengan autorización para consultar o administrar información académica.

Los usuarios no podrán divulgar, copiar, descargar o compartir información de asistencia perteneciente a terceros sin autorización.

## 9. Seguridad

El responsable del tratamiento implementará medidas técnicas, administrativas y organizativas razonables para proteger la información contra pérdida, adulteración, acceso, consulta, uso o divulgación no autorizada.

Estas medidas deberán aplicarse durante las diferentes etapas del ciclo de vida de la información.

## 10. Disponibilidad del servicio

El sistema se proporciona como una herramienta tecnológica de apoyo a los procesos de asistencia.

Podrían presentarse interrupciones derivadas de mantenimiento, fallos técnicos, problemas de conectividad, infraestructura, servicios de terceros u otras circunstancias ajenas al control del responsable.

Cuando una falla impida registrar la asistencia, deberán existir mecanismos institucionales alternativos para verificarla cuando corresponda.

## 11. Propiedad intelectual

El software, diseño, documentación, interfaces, código, modelos, bases de datos y demás elementos desarrollados para el proyecto estarán sujetos a las normas de propiedad intelectual aplicables y a los acuerdos establecidos entre los autores, la institución educativa y demás partes involucradas.

El usuario no adquiere derechos de propiedad sobre el software por el simple hecho de utilizarlo.

## 12. Protección de datos personales

El tratamiento de los datos personales se realizará de conformidad con la legislación colombiana aplicable, en especial la **Ley 1581 de 2012** y sus normas reglamentarias.

Los detalles sobre la información recopilada, finalidades, derechos, autorización, conservación y eliminación se encuentran en la **Política de Privacidad y Tratamiento de Datos Personales**.

## 13. Modificaciones

El responsable podrá modificar estos Términos y Condiciones cuando sea necesario para adaptarlos a cambios tecnológicos, académicos, administrativos o normativos.

Las modificaciones relevantes deberán ser informadas a los usuarios mediante los mecanismos disponibles en la plataforma.

## 14. Terminación o suspensión

El acceso de un usuario podrá suspenderse o finalizar cuando:

- Deje de estar autorizado para utilizar el sistema.
- Incumpla estos Términos y Condiciones.
- Se detecten actividades fraudulentas.
- Exista un riesgo para la seguridad de la plataforma o de otros usuarios.
- Existan razones académicas, administrativas o legales que lo justifiquen.

La suspensión no afectará los derechos que legalmente correspondan al titular de los datos personales.

## 15. Legislación aplicable

Estos Términos y Condiciones se rigen por las normas vigentes de la **República de Colombia**.

En materia de protección de datos personales se observarán, entre otras, la Ley 1581 de 2012 y sus normas reglamentarias y complementarias.

## 16. Aceptación

Al seleccionar la opción de aceptación, el usuario declara que ha leído y comprendido estos Términos y Condiciones y acepta las condiciones de uso de la plataforma.

La aceptación de estos Términos es **independiente** de la autorización específica requerida para el tratamiento de datos personales sensibles, incluidos los datos biométricos.

---

## Contacto

- **Responsable:** Universidad Manuela Beltrán
- **Correo:** soporte@umb.edu.co
- **Dirección:** Calle 73 # 73-33, Bogotá D.C., Colombia
`;

export default function TermsAndConditionsModal({ visible, onClose, onAccept, readOnly = false }) {
  return (
    <LegalDocumentModal
      visible={visible}
      onClose={onClose}
      onAccept={onAccept}
      hideAccept={readOnly}
      title="Términos y Condiciones"
      accent="#1E40AF"
      Icon={FileText}
      markdown={TERMS_MARKDOWN}
      acceptLabel="Acepto los Términos y Condiciones"
    />
  );
}
