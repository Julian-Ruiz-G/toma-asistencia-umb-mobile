# Sistema de Toma de Asistencia Académica

**Toma Asistencia UMB — Aplicación móvil para el control de asistencia universitaria**

Toma Asistencia UMB es una aplicación móvil desarrollada para la Universidad Manuela Beltrán. Permite registrar la asistencia académica de los estudiantes mediante códigos QR y reconocimiento facial, con paneles diferenciados para estudiantes, docentes y administradores, y un backend serverless en AWS.

## Demo

`[Add live demo URL]`

## Descripción general

Toma Asistencia UMB es una aplicación móvil diseñada para automatizar el registro de asistencia en clases universitarias, desde el ingreso del estudiante hasta la consulta de reportes por parte de docentes y administradores.

El proyecto busca reemplazar los métodos tradicionales de control de asistencia (listas en papel, firmas manuales o registros poco auditables) por un flujo digital más confiable. Los estudiantes pueden unirse a una clase, escanear un código QR y confirmar su presencia. Los docentes pueden crear clases, generar sesiones de asistencia, consultar el registro en tiempo real y exportar reportes. Los administradores gestionan usuarios, auditoría, consentimientos de datos y la operación general del sistema.

La aplicación fue desarrollada como cliente móvil con Expo y React Native. Se comunica con una API REST desplegada en Amazon API Gateway y AWS Lambda, utiliza DynamoDB como base de datos y AWS Rekognition para la verificación facial.

## Características

- **Autenticación por roles:** Estudiantes, docentes y administradores inician sesión en un mismo formulario. El sistema valida las credenciales contra endpoints distintos y redirige a cada panel según el rol, usando tokens JWT.
- **Registro de estudiantes:** Los estudiantes pueden crear una cuenta con validación de datos y captura de foto de perfil para el reconocimiento facial.
- **Escaneo de códigos QR:** Los estudiantes se unen a clases y marcan asistencia escaneando el QR generado por el docente. Los docentes pueden regenerar el QR de la clase cuando sea necesario.
- **Reconocimiento facial:** El sistema compara el rostro capturado con AWS Rekognition para confirmar la identidad y reducir suplantaciones o registros duplicados.
- **Gestión de clases:** Los docentes pueden crear, actualizar y eliminar clases, definir horarios y administrar la lista de estudiantes inscritos.
- **Asistencia en tiempo real:** Durante una sesión, el docente visualiza quién ya marcó asistencia y puede aplicar correcciones manuales.
- **Historial y horario del estudiante:** Los estudiantes consultan su horario, el historial de asistencia, notificaciones y su perfil.
- **Panel de administración:** Los administradores gestionan estudiantes y docentes, realizan carga masiva, revisan logs, auditorías y consentimientos, y generan un QR institucional.
- **Reportes de asistencia:** El sistema permite previsualizar, exportar e historiar reportes de sesiones en formatos como CSV, Excel y PDF.
- **Actualizaciones OTA:** La aplicación se puede actualizar de forma remota con EAS Update, sin necesidad de republicar en las tiendas.

## Screenshots

Add screenshots in this section when available.

```text
[Add login screenshot]
[Add student home screenshot]
[Add QR scanner screenshot]
[Add teacher dashboard screenshot]
[Add live attendance screenshot]
[Add admin dashboard screenshot]
```

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

### Base de datos

- **Amazon DynamoDB:** Base de datos NoSQL utilizada para usuarios, clases, sesiones, asistencia, logs y consentimientos.
- **Amazon S3:** Almacenamiento previsto para imágenes de perfil y evidencias de asistencia.

### Herramientas / Librerías / Servicios

- **npm:** Gestor de paquetes del cliente móvil.
- **Expo Go:** Utilizado para pruebas locales en dispositivos físicos durante el desarrollo.
- **EAS CLI:** Utilizado para builds nativos y actualizaciones OTA.
- **xlsx:** Permite exportar reportes de asistencia en formato Excel.
- **Git:** Control de versiones del repositorio.

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

## Requisitos e instalación

## Requisitos

* Node.js 18 o superior y npm
* Expo Go compatible con SDK 54, o un emulador Android / simulador iOS
* Acceso a la API de AWS configurada en `app.json`
* Cuenta de Expo (opcional, necesaria para builds con EAS)

## Instalación rápida

```powershell
# 1. Clonar el repositorio
git clone https://github.com/Julian-Ruiz-G/toma-asistencia-umb-mobile.git
cd toma-asistencia-umb-mobile

# 2. Instalar dependencias
npm install

# 3. Iniciar la aplicación
npx expo start --lan --clear
```

> Para Expo Go, el dispositivo y el computador deben estar en la misma red local.
> En Android, escanea el código QR desde la app Expo Go. En iOS, puedes usar la cámara del dispositivo.

Comprueba que la API esté configurada en `app.json` → `expo.extra.apiUrl`.

## Variables de entorno

La URL del backend se configura en `app.json`, no en un archivo `.env`. El cliente lee ese valor mediante `expo-constants` y construye el resto de endpoints en `src/config.js`.

| Variable           | Descripción                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `expo.extra.apiUrl` | URL base del API Gateway. Debe apuntar al recurso `/recognize` del backend |
| `expo.extra.eas.projectId` | Identificador del proyecto en Expo, requerido para EAS Build y EAS Update |

Ejemplo:

```json
"extra": {
  "apiUrl": "https://tu-api.execute-api.us-east-2.amazonaws.com/Prod/recognize"
}
```

## Despliegue

El backend ya se encuentra desplegado en AWS (API Gateway + Lambda). Este repositorio corresponde al cliente móvil.

Para generar un binario de producción:

```powershell
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

Para publicar una actualización OTA sin reconstruir la app nativa:

```powershell
eas update --branch preview --message "Descripción del cambio"
```

Actualmente no hay una demo web pública. La aplicación está pensada para ejecutarse en Expo Go o en un build nativo.

## Uso del sistema

El sistema contempla diferentes flujos según el rol del usuario:

1. La aplicación muestra la pantalla inicial y permite iniciar sesión o registrar un estudiante.
2. El usuario ingresa sus credenciales. El cliente intenta autenticarse como administrador, estudiante o docente y guarda el token JWT junto con el rol.
3. El estudiante puede consultar su horario, unirse a una clase escaneando un QR y marcar asistencia durante una sesión activa.
4. Al marcar asistencia, la aplicación valida el código QR de la sesión y puede solicitar una captura facial para confirmar la identidad.
5. El docente crea o gestiona sus clases, genera el QR de la sesión y abre el tablero de asistencia en vivo.
6. Desde el tablero, el docente revisa quién ya asistió, aplica correcciones manuales y consulta el historial de sesiones.
7. El docente o administrador genera reportes de asistencia, los previsualiza y los exporta.
8. El administrador gestiona estudiantes y docentes, realiza cargas masivas, revisa logs y auditorías, y administra los consentimientos de tratamiento de datos.

## Estructura del proyecto

```text
toma-asistencia-umb-mobile/
├── assets/                      # iconos, splash y recursos visuales de Expo
├── src/
│   ├── screens/
│   │   ├── auth/                # splash, bienvenida, login y registro
│   │   ├── student/             # inicio, QR, horario, perfil e historial
│   │   ├── teacher/             # clases, sesiones, QR y asistencia en vivo
│   │   ├── admin/               # usuarios, auditoría, logs y consentimientos
│   │   └── reports/             # dashboard, previsualización e historial de reportes
│   ├── components/              # Button, Card e Input reutilizables
│   ├── navigation/              # stack navigator de la aplicación
│   ├── state/                   # contexto de autenticación y sesión
│   ├── utils/                   # horarios y exportación de reportes
│   ├── config.js                # construcción de endpoints de la API
│   └── theme.js                 # paleta de colores institucional
├── App.js                       # punto de entrada de la UI (Auth + navegación)
├── index.js                     # registro del componente raíz de Expo
├── app.json                     # configuración de Expo y URL de la API
├── eas.json                     # perfiles de build y envío
├── metro.config.js              # configuración de Metro y NativeWind
└── README.md
```


## Licencia
Este proyecto es propiedad de la Universidad Manuela Beltrán.

## Autores

**Julian Aya Orozco**
[GitHub](https://github.com/JulianAyaO)

**Julian Ruiz**
[GitHub](https://github.com/Julian-Ruiz-G)

**Marlon Perez**
[GitHub](https://github.com/MarlonPerezR)

## Licencia

Este proyecto es propiedad de la Universidad Manuela Beltrán.

---

