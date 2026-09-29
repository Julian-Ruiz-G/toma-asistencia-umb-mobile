# Backend de Toma Asistencia UMB (AWS)

API serverless (API Gateway + una Lambda en Python 3.12) para la app de asistencia UMB. Usa DynamoDB, Amazon Rekognition, SES y un bucket S3 privado para las justificaciones.

## Estructura

- `src/lambda_handler.py`: punto de entrada (`lambda_handler.lambda_handler`) y tabla de rutas.
- `src/runtime.py`: configuración, helpers de DynamoDB (`_ddb_scan` pagina toda la tabla), JWT, contraseñas (scrypt), captcha y reglas de horario.
- `src/routes/`: handlers por área (`auth`, `admin`, `bulk`, `classes`, `attendance`, `justifications`, `recognize`).
- `tests/`: pruebas sin llamadas reales a AWS.
- `template.yaml`: plantilla SAM.

## Requisitos previos

- Colección de Rekognition (`recoEstu` por defecto) y tabla DynamoDB (`face_recognition`) con PK `RekognitionId` (S), en la misma región del despliegue.
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configurado y [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html). En Windows conviene Docker Desktop para `sam build --use-container` (Pillow).

## Configuración y secretos

1. Copia `samconfig.example.toml` como `samconfig.toml`. Ese archivo está en `.gitignore`: **nunca lo subas al repositorio**.
2. Genera dos secretos distintos:
   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
   - `AuthSecret` (obligatorio, 32+ caracteres): firma los JWT de sesión, QR y captcha. Cambiarlo cierra todas las sesiones abiertas.
   - `AdminToken`: solo habilita `/register-teacher` (header `x-admin-token`). Vacío lo desactiva.
3. Parámetros opcionales:
   - `FaceMatchThreshold` (85 por defecto): similitud mínima para aceptar a alguien en la foto de grupo. Súbelo si aparecen falsos positivos; bájalo si no reconoce a estudiantes presentes.
   - `SesFromEmail`: correo verificado en SES para avisar a cuentas creadas por el administrador. Vacío desactiva el envío.

## Despliegue

Desde cualquier carpeta:

```powershell
powershell -ExecutionPolicy Bypass -File backend\deploy.ps1
```

El script compila con `sam build --use-container`, comprueba que Pillow para Linux quedó en el build y despliega con `sam deploy --template-file .aws-sam\build\template.yaml`.

Si despliegas a mano, `sam deploy` debe usar **el template del build**, no `backend\template.yaml`. Con este último se sube `src\` sin dependencias: la Lambda queda sin Pillow y el reconocimiento de la foto de grupo no funciona (el backend responde `GroupRecognitionUnavailable` y no modifica la asistencia).

```powershell
sam deploy --template-file backend\.aws-sam\build\template.yaml --config-file backend\samconfig.toml
```

La primera vez puedes usar `sam deploy --guided`. Al terminar, copia el output `ApiUrl` en `apps/mobile/app.json` (`expo.extra.apiUrl`).

## Cuentas y contraseñas

- El registro de estudiantes no pide código por correo: basta con el correo institucional `@academia.umb.edu.co`, que no puede repetirse, más la foto y el captcha.
- No hay recuperación por correo. Si alguien olvida su contraseña, el administrador le asigna una temporal desde el panel (Estudiantes o Docentes → Editar). La app obliga a cambiarla al entrar.
- Las contraseñas se guardan con scrypt. Las cuentas con el hash SHA-256 anterior siguen funcionando y se migran solas en su siguiente inicio de sesión.

## Asistencia por QR

El QR de asistencia vale 90 segundos y la pantalla del docente lo renueva cada 45. Así, una captura compartida con alguien que no está en el salón deja de servir enseguida. La foto de grupo del docente sigue siendo la confirmación final.

## Justificaciones

El estudiante puede adjuntar un PDF, un Word (.doc o .docx) o una foto (JPG, PNG, WEBP o HEIC) de hasta 4 MB. El backend comprueba el tipo real del archivo por su contenido, no solo por la extensión. Los soportes se guardan en el bucket privado y se abren con una URL temporal de 10 minutos. El docente los revisa en su pantalla de justificaciones; el administrador las consulta todas desde el panel.

## Panel del administrador

- `admin-dashboard-stats`: cifras del tablero, incluidas las justificaciones sin revisar y los consentimientos pendientes.
- `admin-classes`: todas las clases con docente, horario, estudiantes inscritos, sesiones y asistencia acumulada.
- `admin-consents`: consentimientos de estudiantes y docentes. Con `{"action": "request-all", "role": "student" | "teacher" | "all"}` envía la solicitud a todos los que tengan algo pendiente.

## Pruebas

```powershell
pip install -r requirements-dev.txt
python -m pytest tests
```

Sin pytest también puedes correr `python tests/test_dispatcher.py`.

## Seguridad

- Los logs registran solo método y ruta. El body lleva contraseñas y fotos (datos biométricos) y no debe llegar a CloudWatch.
- Las respuestas 5xx no devuelven detalles internos; el error completo queda en CloudWatch.
- `/recognize` exige sesión de docente o administrador. El registro no revela a quién pertenece un rostro o un código ya registrado.
- La tabla no tiene índices secundarios: las búsquedas por correo, clase o sesión recorren la tabla completa (con paginación). Si el volumen crece, conviene añadir GSIs (por ejemplo `Email`, y `Type` + `ClassId`) y pasar esas búsquedas a `query`.

## Errores comunes

- `No faces detected`: imagen borrosa, muy pequeña o fuera de foco.
- `AccessDeniedException`: la colección no existe en la región o el rol no tiene permisos.
- `ResourceNotFoundException` en DynamoDB: revisa que la tabla y la PK `RekognitionId` existan en la región del despliegue.
- `AuthSecretNotConfigured` en los logs: falta el parámetro `AuthSecret` en el despliegue.
