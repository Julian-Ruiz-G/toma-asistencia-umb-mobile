# App móvil + Backend de reconocimiento facial (AWS)

Backend serverless (AWS Lambda + API Gateway) para la app de asistencia UMB. Usa Amazon Rekognition y DynamoDB. El código de la función vive en `src/`.

## Estructura

- `src/lambda_handler.py`: punto de entrada SAM (`lambda_handler.lambda_handler`).
- `src/`: módulos de rutas y utilidades.
- `template.yaml`: plantilla SAM.
- `../scripts/rekognition_probe.py`: script local de referencia para Rekognition.

## Requisitos previos

- AWS Account con una colección de Rekognition existente (`famouspersons`) y una tabla DynamoDB (`face_recognition`) con:
  - PK: `RekognitionId` (S)
  - Atributo: `FullName` (S)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configurado (`aws configure`).
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html). En Windows, recomendable Docker Desktop y usar `sam build --use-container`.

## Despliegue

1. (Opcional) Ajusta parámetros en `template.yaml`:
   - `CollectionName` (por defecto `famouspersons`)
   - `DDBTableName` (por defecto `face_recognition`)
   - `FaceMatchThreshold` y `MaxMatches`
2. Build del proyecto:
   ```powershell
   sam build --use-container
   ```
3. Deploy guiado (primera vez):
   ```powershell
   sam deploy --guided
   ```
   - Elige un `Stack Name` (p.ej. `face-api`)
   - Region (p.ej. `us-east-2`)
   - Acepta crear roles y guarda las opciones para reutilizarlas
4. Copia el Output `ApiUrl` al finalizar (termina con `/recognize`).

## Probar con PowerShell (local)

```powershell
$imgPath = "pru.jpg" # cambia al path de tu imagen
$imgB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($imgPath))
$body = @{ imageBase64 = $imgB64 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://<api-id>.execute-api.<region>.amazonaws.com/Prod/recognize" -ContentType "application/json" -Body $body
```

También puedes usar el valor `ApiUrl` que SAM imprime tras el deploy.

## App móvil (Expo/React Native) - Ejemplo de cliente

- Instala Expo y el paquete para elegir imágenes (`expo-image-picker`).
- Pide permisos, selecciona/captura una foto con `base64: true` y envía al endpoint.
- El backend responde con:
  - `facesDetected`: cantidad de rostros detectados.
  - `matches`: lista con `faceId`, `confidence`, `fullName` (si está en DynamoDB).
  - `recognized`: `true` si al menos un `fullName` fue encontrado.

Pseudo-flujo en tu app:

1. Abrir selector de imagen (o cámara) y obtener `base64`.
2. POST a `ApiUrl` con JSON `{ imageBase64: "..." }`.
3. Si `recognized` es `true`, permitir continuar; de lo contrario, mostrar mensaje.

> Nota: si obtienes una cadena `data:image/jpeg;base64,XXXX`, el backend la acepta (elimina el prefijo internamente).

## Extensión a múltiples rostros

Actualmente el backend usa `search_faces_by_image` sobre la imagen completa (Rekognition buscará el rostro principal). Para múltiples rostros como tu `testing.py`, puedes:

- Añadir `Pillow` y recortar los bounding boxes detectados por `detect_faces` para enviar cada rostro recortado a `search_faces_by_image`.
- Con SAM, agrega `src/requirements.txt` con `Pillow` y vuelve a compilar con `sam build --use-container` desde esta carpeta.

## Seguridad y buenas prácticas

- No incluyas credenciales de AWS en la app móvil.
- Si la API es sensible (autenticación), añade API Keys, Cognito Authorizer o JWT en API Gateway.
- Limita permisos IAM (el template ya restringe DynamoDB a una tabla específica).

## Errores comunes

- `No faces detected`: imagen borrosa, muy pequeña o fuera de foco.
- `AccessDeniedException`: la colección no existe en la región o el rol no tiene permisos.
- `ResourceNotFoundException` DynamoDB: revisa que la tabla y PK `RekognitionId` existan en la región del despliegue.
