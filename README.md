# Toma Asistencia UMB

Aplicación móvil para el control de asistencia en la Universidad Manuela Beltrán. Los estudiantes marcan presencia con código QR y reconocimiento facial; docentes y administradores gestionan clases, sesiones, reportes y usuarios. Cliente en Expo / React Native; API serverless en AWS (API Gateway, Lambda, DynamoDB y Rekognition).

## Características

- Autenticación por roles (estudiante, docente, administrador) con JWT
- Registro de estudiantes con foto de perfil para verificación facial
- Escaneo de QR para unirse a clase y marcar asistencia
- Tablero de asistencia en vivo, correcciones manuales y gestión de clases
- Historial, horario y perfil del estudiante
- Panel de administración: usuarios, carga masiva, auditoría, logs y consentimientos
- Reportes exportables (CSV, Excel, PDF)
- Actualizaciones OTA con EAS Update

## Tecnologías

**Frontend (Móvil)** React Native, Expo SDK 54, React Navigation, NativeWind, Expo Camera, Expo Updates.

**Backend:** AWS Lambda (Python 3.12), API Gateway, DynamoDB, Rekognition. S3 está previsto para imágenes de perfil y evidencias.

**Herramientas:** Expo Go, EAS CLI.

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

1. **Auth:** App → API → Lambda → DynamoDB → JWT  
2. **Rostro:** App → API → Lambda → Rekognition → DynamoDB  
3. **Asistencia:** App (QR + rostro) → API → Lambda → DynamoDB  
4. **Reportes:** App → API → Lambda → DynamoDB → App  

## Requisitos

- Node.js 18+ y npm
- Expo Go (SDK 54) o emulador Android / simulador iOS
- URL de la API configurada en `app.json`
- Cuenta de Expo (solo para builds con EAS)

## Instalación

```powershell
git clone https://github.com/Julian-Ruiz-G/toma-asistencia-umb-mobile.git
cd toma-asistencia-umb-mobile
npm install
npx expo start --lan --clear
```

El dispositivo y el computador deben estar en la misma red. En Android, escanea el QR con Expo Go; en iOS puedes usar la cámara.

La URL del backend va en `app.json` (`expo.extra.apiUrl`), no en un `.env`. El cliente la lee con `expo-constants` y arma el resto de endpoints en `src/config.js`.

| Variable | Descripción |
| --- | --- |
| `expo.extra.apiUrl` | URL base del API Gateway (recurso `/recognize`) |
| `expo.extra.eas.projectId` | ID del proyecto Expo (EAS Build / Update) |

```json
"extra": {
  "apiUrl": "https://tu-api.execute-api.us-east-2.amazonaws.com/Prod/recognize"
}
```

## Despliegue

Este repositorio es solo el cliente móvil; el backend ya está en AWS.

```powershell
eas build --platform android --profile production
eas build --platform ios --profile production
eas update --branch preview --message "Descripción del cambio"
```

No hay demo web pública: se usa Expo Go o un build nativo.


## Autores

| Autor | GitHub |
| :--- | :---: |
| **Julian Aya Orozco** | [![GitHub](https://img.shields.io/badge/GitHub-JulianAyaO-181717?logo=github&logoColor=white)](https://github.com/JulianAyaO) |
| **Julian Ruiz** | [![GitHub](https://img.shields.io/badge/GitHub-Julian--Ruiz--G-181717?logo=github&logoColor=white)](https://github.com/Julian-Ruiz-G) |
| **Marlon Perez** | [![GitHub](https://img.shields.io/badge/GitHub-MarlonPerezR-181717?logo=github&logoColor=white)](https://github.com/MarlonPerezR) |

## Licencia

Este proyecto es propiedad de la Universidad Manuela Beltrán.
