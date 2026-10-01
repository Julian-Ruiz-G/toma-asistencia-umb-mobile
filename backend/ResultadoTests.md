# Resultado de las pruebas del backend

**Fecha de ejecución:** 2026-09-29 19:55 (hora de Colombia) — incluye la corrección del bug de matching
**Entorno:** Windows 11 · Python 3.13.7 · pytest 9.1.1 · boto3/botocore 1.40.40 · Pillow 11.3.0

## Resumen

| Archivo | Tests | Pasan | Fallo esperado (bug conocido) | Fallan |
|---|---:|---:|---:|---:|
| `tests/test_dispatcher.py` | 43 | 43 | 0 | 0 |
| `tests/test_attendance_rules.py` (nuevo) | 16 | 16 | 0 | 0 |
| **Total** | **59** | **59** | **0** | **0** |

Resultado de pytest: `59 passed in 1.25s`.

En la primera ejecución (19:43) el resultado fue `57 passed, 1 xfailed`: un test marcado como fallo esperado demostraba un **bug real** del reconocimiento facial. El bug ya está corregido y ese test pasa; ver [Hallazgos](#hallazgos).

## Cómo se ejecutan

Desde la carpeta `backend`:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest tests -v
```

Las pruebas no llaman a AWS:

- **Rekognition** se simula con `botocore.stub.Stubber`. Además de devolver respuestas, verifica que cada llamada use los parámetros correctos: `CollectionId`, `FaceMatchThreshold`, `MaxFaces` y el orden de `detect_faces` / `search_faces_by_image`.
- **DynamoDB** se reemplaza por una tabla en memoria, para revisar el estado final de cada registro de asistencia.
- **La foto** es una imagen JPEG real generada con Pillow, así que se ejecuta el recorte de cada rostro.
- **La hora** se fija en 2026-09-30 10:00 (Colombia), para que el resultado no dependa de cuándo se ejecuten.

Con la configuración por defecto de las pruebas, el umbral de similitud es 60, `MaxFaces` es 5 y la colección es `recoEstu`. En producción el umbral es 85 (parámetro `FaceMatchThreshold` del `template.yaml`). Las pruebas verifican que se use el valor configurado, sea cual sea.

## Pruebas nuevas: `tests/test_attendance_rules.py`

Cubren la lógica crítica de `/confirm-attendance-photo`, es decir, la foto grupal que confirma la asistencia.

### Reglas de estado

| # | Prueba | Situación | Resultado esperado | Estado |
|---|---|---|---|---|
| 1 | `test_presente_en_foto_sin_qr_queda_asistencia_a_tiempo` | No marcó QR, sale en la foto, dentro de los 15 min | `asistencia`, método `face` | ✅ Pasa |
| 2 | `test_presente_en_foto_despues_del_limite_queda_retardo` | No marcó QR, sale en la foto, 40 min después del inicio | `retardo` | ✅ Pasa |
| 3 | `test_qr_asistencia_y_en_foto_conserva_asistencia` | Marcó QR a tiempo y sale en la foto (tomada tarde) | Conserva `asistencia` | ✅ Pasa |
| 4 | `test_qr_retardo_y_en_foto_conserva_retardo` | Marcó QR tarde y sale en la foto | Conserva `retardo` | ✅ Pasa |
| 5 | `test_qr_sin_estar_en_foto_baja_a_inasistencia` | Marcó QR pero no sale en la foto (QR reenviado) | Baja a `inasistencia` | ✅ Pasa |
| 6 | `test_sin_qr_y_sin_foto_queda_inasistencia` | No marcó QR ni sale en la foto | `inasistencia`, método `photo` | ✅ Pasa |
| 7 | `test_justificada_se_mantiene_aunque_no_salga_en_la_foto` | Tiene falta justificada y no sale en la foto | `asistencia` (método `justification`) | ✅ Pasa |
| 8 | `test_un_rostro_sin_identificar_no_baja_los_estados_del_qr` | Foto con 1 rostro que no se reconoce | Se conservan los estados del QR | ✅ Pasa |
| 9 | `test_la_sesion_queda_bloqueada_con_las_cifras_de_la_foto` | 3 rostros, 2 reconocidos | Sesión bloqueada con 3 / 2 / 1 sin identificar | ✅ Pasa |

### Matching de rostros contra el roster de la clase

| # | Prueba | Situación | Resultado esperado | Estado |
|---|---|---|---|---|
| 10 | `test_busca_cada_rostro_con_los_parametros_configurados` | 2 rostros | Exactamente 2 búsquedas, con colección, umbral y `MaxFaces` configurados | ✅ Pasa |
| 11 | `test_elige_el_match_de_mayor_similitud` | Rekognition devuelve Ana (86 %) y Luis (99,5 %) | Gana Luis | ✅ Pasa |
| 12 | `test_ignora_rostros_de_personas_fuera_de_la_clase` | En la foto hay alguien no matriculado | No se le crea asistencia | ✅ Pasa |
| 13 | `test_mismo_estudiante_en_dos_rostros_cuenta_una_vez` | Dos rostros se reconocen como Ana | Cuenta 1 presente | ✅ Pasa |
| 14 | `test_usa_el_mejor_match_que_si_esta_en_la_clase` | 1.º candidato de otra clase (99 %), 2.º Ana matriculada (95 %) | Ana queda presente | ✅ Pasa (antes fallaba: bug corregido) |
| 15 | `test_sin_pillow_varias_caras_no_modifica_la_asistencia` | El servidor no puede separar los rostros | Error 503 sin escribir nada ni bloquear la sesión | ✅ Pasa |
| 16 | `test_vista_previa_usa_el_mejor_match_que_si_esta_en_la_clase` | Mismo caso que la 14, en la vista previa `/recognize-class` | Ana aparece como reconocida | ✅ Pasa |

## Verificación de que las pruebas detectan errores

Para comprobar que las pruebas no pasan "por casualidad", se introdujeron errores a propósito en una **copia** del código (el código real no se modificó) y se ejecutó `test_attendance_rules.py` contra cada copia:

| Error introducido | ¿Lo detectan las pruebas? | Prueba que falla |
|---|---|---|
| La falta justificada ya no se respeta | ✅ Sí | `test_justificada_se_mantiene_aunque_no_salga_en_la_foto` |
| Quien marcó QR y no sale en la foto ya no baja a inasistencia | ✅ Sí | `test_qr_sin_estar_en_foto_baja_a_inasistencia` |
| Se quita la protección de "1 rostro sin identificar" | ✅ Sí | `test_un_rostro_sin_identificar_no_baja_los_estados_del_qr` |
| Se toma el match de **menor** similitud | ✅ Sí | `test_elige_el_match_de_mayor_similitud` |
| Se aceptan rostros de personas fuera de la clase | ✅ Sí | `test_ignora_rostros_de_personas_fuera_de_la_clase` |
| El retardo nunca se aplica en la foto | ✅ Sí | `test_presente_en_foto_despues_del_limite_queda_retardo` |

**6 de 6 errores detectados.**

## Hallazgos

### 1. Bug (CORREGIDO): un estudiante matriculado podía quedar como inasistencia aunque saliera en la foto

- **Dónde estaba:** `routes/attendance.py` (`_search_best_email_with_score`) y el mismo patrón en `routes/recognize.py` (`_search_best_match`).
- **Qué pasa:** por cada rostro, Rekognition devuelve hasta `MaxFaces` (5) candidatos de **toda la universidad**. El código se queda solo con el de mayor similitud y, si esa persona no está matriculada en la clase, descarta el rostro. Si el estudiante correcto venía en 2.º o 3.er lugar, se pierde y queda como `inasistencia`.
- **Cuándo es más probable:** con gemelos o personas muy parecidas, fotos con poca resolución (estudiantes al fondo del salón) o una colección grande.
- **Corrección aplicada:** los candidatos se recorren de mayor a menor similitud y gana el primero que **sí está matriculado en la clase**. Si ninguno lo está, el rostro queda sin identificar, como antes. El correo de cada candidato se consulta una sola vez por foto, con caché. Se aplicó en la confirmación con foto y en la vista previa, y se eliminó `_search_best_email`, una copia vieja que ya no se usaba.
- **Pruebas que lo protegen:** `test_usa_el_mejor_match_que_si_esta_en_la_clase`, que antes estaba marcada como fallo esperado y ahora pasa, y `test_vista_previa_usa_el_mejor_match_que_si_esta_en_la_clase` (nueva).
- **Para que llegue a producción:** hay que desplegar el backend.

### 2. Regla a confirmar con la universidad: la falta justificada cuenta como `asistencia`

Cuando un estudiante tiene una falta justificada, la confirmación con foto la guarda como `asistencia` (con método `justification`) aunque no salga en la foto. La prueba 7 documenta ese comportamiento actual. Si la regla institucional es que una falta justificada **no** sume como asistencia (por ejemplo, que quede como `justificada`), hay que cambiar el código y esta prueba.

## Pruebas existentes: `tests/test_dispatcher.py`

Las 43 pruebas pasan. Cubren el enrutador de la Lambda y reglas transversales:

- **Rutas y autenticación:** rutas registradas, CORS, rutas eliminadas, rechazo de peticiones sin sesión o con el rol equivocado.
- **Contraseñas y captcha:** contraseñas con scrypt y migración del hash antiguo; captcha (reto, pase de 30 minutos, respuesta que no se filtra).
- **Estudiantes:** creación por el admin (rostro indexado, cambio de contraseña obligatorio, rostro o correo duplicado) y aviso de rostro ya registrado al tomar la foto de registro.
- **Clases:** formato de ID `123456-123_A1` al crear y editar, sin sobrescribir clases existentes.
- **Tablero del admin:** conteos, asistencia de hoy por carrera, consentimientos y clases.
- **Perfiles sin datos (regresión):** las notificaciones no aparecen como cuentas y las actualizaciones sobre cuentas borradas no crean perfiles vacíos.
- **Foto grupal sin Pillow:** responde error y no marca inasistencias falsas.
- **Otros:** paginación de scans de DynamoDB, carga masiva, tipos de archivo de las justificaciones y errores 500 que no filtran detalles internos.
