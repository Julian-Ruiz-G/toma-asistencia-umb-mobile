# Sistema de Toma de Asistencia Académica - App Móvil

## ¿Qué es?

Una aplicación móvil desarrollada para la Universidad Manuela Beltrán que permite controlar la asistencia académica de estudiantes mediante reconocimiento facial y códigos QR. El sistema automatiza el registro de asistencia, reduce errores manuales y proporciona reportes en tiempo real para docentes y administradores.

## ¿Qué problema resuelve?

El sistema resuelve el problema tradicional de controlar asistencia académica mediante métodos manuales (listas en papel, firmas manuales), que son:

- **Propensos a errores:** Listas perdidas, nombres mal escritos, asistencia falsificada
- **Ineficientes:** Requieren tiempo para procesar y digitalizar
- **Difíciles de auditar:** No hay registro visual de quién asistió realmente
- **Limitados:** No permiten análisis en tiempo real ni reportes automáticos

## Funcionalidades

### Autenticación
- Login para estudiantes, docentes y administradores
- Registro de estudiantes con validación de datos
- Verificación de credenciales mediante tokens JWT
- Recuperación de contraseña (pendiente)

### Identificación y Registro
- **Escaneo QR:** Generación y escaneo de códigos QR para unirse a clases y marcar asistencia
- **Reconocimiento Facial:** Captura y comparación de rostros usando AWS Rekognition
- **Detección de duplicados:** Verificación de rostros y códigos estudiantiles ya registrados

### Gestión de Asistencia
- **Para Estudiantes:**
  - Escanear QR para marcar asistencia
  - Ver historial de asistencia
  - Ver horario de clases
  - Recibir notificaciones de asistencia

- **Para Docentes:**
  - Crear y gestionar clases
  - Generar códigos QR de clase
  - Ver asistencia en tiempo real
  - Correcciones manuales de asistencia
  - Ver historial de sesiones
  - Reportes de asistencia

- **Para Administradores:**
  - Gestión de estudiantes y docentes
  - Auditoría de logs del sistema
  - Gestión de consentimientos de datos
  - Carga masiva de estudiantes
  - Dashboard con estadísticas
  - Generación de QR institucional

### Captura de Imágenes
- Captura de fotos de perfil para estudiantes
- Captura de fotos durante el reconocimiento facial
- Validación de calidad de imágenes (sin gafas, pose correcta)

### Reportes
- Exportación de reportes de asistencia
- Historial de asistencia por estudiante
- Estadísticas de asistencia por clase
- Auditoría de cambios en el sistema

## Tecnologías

### Frontend (Móvil)
- **React Native:** Framework principal
- **Expo SDK 54:** Plataforma de desarrollo
- **JavaScript:** Lenguaje de programación
- **Expo Camera:** Captura de imágenes y escaneo QR
- **React Navigation:** Navegación entre pantallas
- **NativeWind:** Estilos con Tailwind CSS
- **Lucide React Native:** Iconos
- **Expo Updates:** Actualizaciones OTA (Over-The-Air)

### Backend
- **AWS Lambda:** Funciones serverless
- **Python 3.12:** Lenguaje de programación
- **Amazon API Gateway:** API REST
- **Amazon DynamoDB:** Base de datos NoSQL
- **AWS Rekognition:** Reconocimiento facial
- **AWS S3:** Almacenamiento de imágenes (pendiente)

### DevOps
- **EAS CLI:** Build y actualizaciones de Expo
- **GitHub Actions:** CI/CD para actualizaciones automáticas
- **Git:** Control de versiones

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Aplicación Móvil                         │
│              (React Native + Expo)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Estudiante│  │ Docente  │  │ Admin    │  │  QR      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Amazon API Gateway                         │
│              (https://rvf0u5jr9f.execute-api...)             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS Lambda Functions                      │
│                    (Python 3.12)                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Auth     │  │ Classes  │  │Attendance│  │ Reports  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│  DynamoDB        │ │ AWS          │ │  AWS S3      │
│  (face_recognition)│ Rekognition  │ │ (Imágenes)   │
└──────────────────┘ └──────────────┘ └──────────────┘
```

### Flujo de Datos

1. **Autenticación:** App → API Gateway → Lambda (verifica credenciales) → DynamoDB → Token JWT
2. **Registro Facial:** App → API Gateway → Lambda (captura imagen) → AWS Rekognition → DynamoDB
3. **Marcado de Asistencia:** App (escanea QR) → API Gateway → Lambda (verifica QR + rostro) → DynamoDB
4. **Reportes:** App → API Gateway → Lambda (consulta datos) → DynamoDB → App

## Instalación

### Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Expo CLI
- Cuenta de AWS (para backend)
- Git

### Pasos de Instalación

1. **Clonar el repositorio:**
```bash
git clone <URL_DEL_REPOSITORIO>
cd toma-asistencia-umb-mobile
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Configurar variables de entorno:**
   - Editar `app.json` y configurar `extra.apiUrl` con la URL de tu API Gateway
   - Asegúrate de que `extra.eas.projectId` esté configurado correctamente

4. **Iniciar el servidor de desarrollo:**
```bash
npx expo start
```

5. **Ejecutar en dispositivo:**
   - **Android:** Instala Expo Go desde Google Play y escanea el QR de la terminal
   - **iOS:** Usa la app Expo o escanea el QR con la cámara
   - **Web:** Presiona `w` en la terminal para abrir en el navegador

### Build para Producción

**Para Android:**
```bash
eas build --platform android --profile production
```

**Para iOS:**
```bash
eas build --platform ios --profile production
```

### Actualizaciones OTA (Over-The-Air)

```bash
eas update --branch preview --message "Descripción del cambio"
```

## Capturas de Pantalla

*(Nota: Agrega capturas de pantalla reales de tu aplicación)*

### Login
- Pantalla de inicio de sesión para estudiantes, docentes y administradores
- Validación de credenciales

### Pantalla Principal (Estudiante)
- Vista de horario de clases
- Acceso a escaneo QR
- Historial de asistencia

### Pantalla Principal (Docente)
- Lista de clases asignadas
- Creación de nuevas clases
- Generación de códigos QR

### Escaneo QR
- Interfaz de cámara para escanear códigos QR
- Validación de códigos de clase
- Marcado automático de asistencia

### Reconocimiento Facial
- Captura de foto de perfil
- Validación de calidad de imagen
- Detección de rostros duplicados

### Registro de Asistencia
- Vista en tiempo real de asistencia
- Lista de estudiantes presentes/ausentes
- Correcciones manuales

### Reportes
- Exportación de reportes de asistencia
- Estadísticas por clase
- Historial de sesiones

## Estado del Proyecto

**Estado:** En desarrollo activo

### Funcionalidades Implementadas
- ✅ Autenticación de usuarios (estudiantes, docentes, admin)
- ✅ Registro de estudiantes con validación de datos
- ✅ Escaneo de códigos QR
- ✅ Reconocimiento facial con AWS Rekognition
- ✅ Gestión de clases (crear, actualizar, eliminar)
- ✅ Marcado de asistencia con QR y rostro
- ✅ Historial de asistencia
- ✅ Dashboard para docentes y administradores
- ✅ Reportes de asistencia
- ✅ Validación de duplicados (rostros y códigos)
- ✅ Actualizaciones OTA con EAS Update
- ✅ GitHub Actions para CI/CD

### Funcionalidades Pendientes
- ⏳ Recuperación de contraseña
- ⏳ Almacenamiento de imágenes en S3
- ⏳ Notificaciones push
- ⏳ Modo offline
- ⏳ Optimización de rendimiento
- ⏳ Pruebas unitarias y E2E

### Problemas Conocidos
- ⚠️ El escaneo QR en Android requiere build nativo con permisos de cámara
- ⚠️ El reconocimiento facial puede fallar con condiciones de luz pobres
- ⚠️ Los builds de EAS pueden tardar 20-40 minutos

## Contribución

Este proyecto es desarrollado para la Universidad Manuela Beltrán. Para contribuir:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/NuevaFuncionalidad`)
3. Commit tus cambios (`git commit -m 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/NuevaFuncionalidad`)
5. Abre un Pull Request

## Licencia

Este proyecto es propiedad de la Universidad Manuela Beltrán.

## Contacto

Para preguntas o soporte, contacta al equipo de desarrollo de la UMB.

---

**Última actualización:** Agosto 2026
**Versión:** 1.0.0
