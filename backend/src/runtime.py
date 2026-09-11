import os
import json
import base64
import logging
import io
import csv
import hashlib
import secrets
import hmac
import uuid
import time
import datetime
import re
from typing import Any

import boto3
from botocore.exceptions import ClientError


PIL_IMPORT_ERROR = None
try:
    from PIL import Image, ImageOps  # type: ignore
    PIL_AVAILABLE = True
except Exception:
    Image = None
    ImageOps = None
    PIL_AVAILABLE = False
    try:
        import traceback

        PIL_IMPORT_ERROR = traceback.format_exc()
    except Exception:
        PIL_IMPORT_ERROR = 'Unknown Pillow import error'

RESAMPLE = None
if PIL_AVAILABLE:
    try:
        RESAMPLE = Image.LANCZOS
    except AttributeError:
        try:
            RESAMPLE = Image.Resampling.LANCZOS
        except Exception:
            RESAMPLE = Image.BICUBIC

logger = logging.getLogger()
logger.setLevel(logging.INFO)

try:
    if not PIL_AVAILABLE and PIL_IMPORT_ERROR:
        logger.warning(f"Pillow import failed: {PIL_IMPORT_ERROR}")
except Exception:
    pass

# Environment/config
REGION = os.getenv('REGION', 'us-east-2')
COLLECTION = os.getenv('COLLECTION', 'recoEstu')
DDB_TABLE = os.getenv('DDB_TABLE', 'face_recognition')
FACE_MATCH_THRESHOLD = int(os.getenv('FACE_MATCH_THRESHOLD', '60'))
MAX_MATCHES = int(os.getenv('MAX_MATCHES', '5'))
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', '')
AUTH_SECRET = os.getenv('AUTH_SECRET', '') or ADMIN_TOKEN

# Attendance schedule timezone: Colombia is UTC-5 (no DST)
CO_TZ_OFFSET_SECONDS = -5 * 60 * 60
CO_TZ = datetime.timezone(datetime.timedelta(hours=-5))


def _clock_colombia(epoch) -> str:
    try:
        dt = datetime.datetime.fromtimestamp(int(epoch), tz=datetime.timezone.utc).astimezone(CO_TZ)
        return dt.strftime('%I:%M %p').lstrip('0')
    except Exception:
        return ''

rekognition = boto3.client('rekognition', region_name=REGION)
dynamodb = boto3.client('dynamodb', region_name=REGION)


def _looks_like_face_id(pk: str) -> bool:
    s = (pk or '').strip()
    if not s or '#' in s:
        return False
    return True

def _delete_faces_from_collection(face_ids: list) -> dict:
    ids = [str(x).strip() for x in (face_ids or []) if str(x or '').strip()]
    if not ids:
        return {'ok': True, 'deleted': [], 'skipped': True}
    try:
        resp = rekognition.delete_faces(CollectionId=COLLECTION, FaceIds=ids)
        return {
            'ok': True,
            'deleted': resp.get('DeletedFaces') or [],
            'unsuccessful': resp.get('UnsuccessfulFaceDeletions') or [],
        }
    except Exception as e:
        logger.exception('Rekognition delete_faces failed')
        return {'ok': False, 'error': str(e), 'deleted': []}


def _delete_related_items_by_student_email(email: str) -> int:
    e = (email or '').strip().lower()
    if not e:
        return 0
    deleted = 0
    last_key = None
    for _ in range(0, 20):
        kwargs = {
            'TableName': DDB_TABLE,
            'FilterExpression': '#SE = :e',
            'ExpressionAttributeNames': {'#SE': 'StudentEmail'},
            'ExpressionAttributeValues': {':e': {'S': e}},
            'Limit': 200,
        }
        if last_key:
            kwargs['ExclusiveStartKey'] = last_key
        try:
            scan_resp = dynamodb.scan(**kwargs)
        except Exception:
            logger.exception('DynamoDB scan failed (related student records)')
            break
        for it in (scan_resp or {}).get('Items') or []:
            pk = _ddb_s(it, 'RekognitionId')
            if not pk:
                continue
            try:
                dynamodb.delete_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': pk}})
                deleted += 1
            except Exception:
                logger.exception(f'DynamoDB delete related item failed pk={pk}')
        last_key = (scan_resp or {}).get('LastEvaluatedKey')
        if not last_key:
            break
    return deleted


def _try_ddb_delete_enrollment_by_pk(enroll_pk: str) -> bool:
    try:
        dynamodb.delete_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': enroll_pk}},
            ConditionExpression='attribute_exists(RekognitionId)'
        )
        return True
    except ClientError as e:
        try:
            if e.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
                return False
        except Exception:
            return False
        raise


def _load_image(image_bytes: bytes) -> Any:
    if not PIL_AVAILABLE:
        raise RuntimeError('PillowNotAvailable')
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    img = img.convert('RGB')
    return img


def _bytes_from_pil(img: Any) -> bytes:
    if not PIL_AVAILABLE:
        raise RuntimeError('PillowNotAvailable')
    buf = io.BytesIO()
    img.save(buf, 'JPEG')
    return buf.getvalue()


def _crop_face_bytes(img: Any, bbox: dict) -> bytes:
    if not PIL_AVAILABLE:
        raise RuntimeError('PillowNotAvailable')
    try:
        w, h = img.size
        left = int(float(bbox.get('Left', 0.0) or 0.0) * w)
        top = int(float(bbox.get('Top', 0.0) or 0.0) * h)
        width = int(float(bbox.get('Width', 0.0) or 0.0) * w)
        height = int(float(bbox.get('Height', 0.0) or 0.0) * h)

        pad_x = int(width * 0.25)
        pad_y = int(height * 0.35)

        x1 = max(0, left - pad_x)
        y1 = max(0, top - pad_y)
        x2 = min(w, left + width + pad_x)
        y2 = min(h, top + height + pad_y)

        cropped = img.crop((x1, y1, x2, y2))
        return _bytes_from_pil(cropped)
    except Exception:
        return _bytes_from_pil(img)


def _cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST'
    }


def _response(status, body):
    return {
        'statusCode': status,
        'headers': _cors_headers(),
        'body': json.dumps(body)
    }


def _response_text(status: int, text: str, content_type: str = 'text/plain; charset=utf-8', extra_headers: dict | None = None):
    h = _cors_headers()
    h['Content-Type'] = content_type
    if extra_headers:
        try:
            for k, v in extra_headers.items():
                h[k] = v
        except Exception:
            pass
    return {
        'statusCode': int(status),
        'headers': h,
        'body': text if isinstance(text, str) else str(text),
    }


def _scan_find_student_by_email(email: str) -> dict | None:
    try:
        if not email:
            return None
        last_key = None
        for _ in range(0, 10):
            kwargs = {
                'TableName': DDB_TABLE,
                'FilterExpression': '#E = :e AND #R = :r',
                'ExpressionAttributeNames': {'#E': 'Email', '#R': 'Role'},
                'ExpressionAttributeValues': {':e': {'S': email}, ':r': {'S': 'student'}},
                'Limit': 200,
            }
            if last_key:
                kwargs['ExclusiveStartKey'] = last_key

            scan_resp = dynamodb.scan(**kwargs)
            items = (scan_resp or {}).get('Items') or []
            if items:
                return items[0]
            last_key = (scan_resp or {}).get('LastEvaluatedKey')
            if not last_key:
                break
        return None
    except Exception:
        return None


def _scan_find_user_by_email(email: str, roles: list[str] | None = None, types: list[str] | None = None) -> dict | None:
    try:
        e = (email or '').strip().lower()
        if not e:
            return None

        roles = roles or []
        types = types or []
        last_key = None

        for _ in range(0, 10):
            clauses = []
            expr_names = {'#E': 'Email'}
            expr_vals = {':e': {'S': e}}

            if roles:
                expr_names['#R'] = 'Role'
                for i, r in enumerate(roles):
                    key = f":r{i}"
                    expr_vals[key] = {'S': str(r)}
                    clauses.append(f"#R = {key}")

            if types:
                expr_names['#T'] = 'Type'
                for i, t in enumerate(types):
                    key = f":t{i}"
                    expr_vals[key] = {'S': str(t)}
                    clauses.append(f"#T = {key}")

            filter_expr = '#E = :e'
            if clauses:
                filter_expr = f"#E = :e AND ({' OR '.join(clauses)})"

            kwargs = {
                'TableName': DDB_TABLE,
                'FilterExpression': filter_expr,
                'ExpressionAttributeNames': expr_names,
                'ExpressionAttributeValues': expr_vals,
                'Limit': 200,
            }
            if last_key:
                kwargs['ExclusiveStartKey'] = last_key

            scan_resp = dynamodb.scan(**kwargs)
            items = (scan_resp or {}).get('Items') or []
            if items:
                return items[0]
            last_key = (scan_resp or {}).get('LastEvaluatedKey')
            if not last_key:
                break
        return None
    except Exception:
        return None


def _audit_log(actor_email: str | None, actor_role: str | None, action: str, details: dict | None = None):
    try:
        now = int(time.time())
        log_id = f"AUDIT#{now}#{uuid.uuid4().hex}".lower()
        item = {
            'RekognitionId': {'S': log_id},
            'Type': {'S': 'AuditLog'},
            'CreatedAt': {'N': str(now)},
            'Action': {'S': str(action or '')},
        }
        if actor_email:
            item['ActorEmail'] = {'S': str(actor_email).strip().lower()}
        if actor_role:
            item['ActorRole'] = {'S': str(actor_role).strip().lower()}
        if isinstance(details, dict) and details:
            item['Details'] = {'S': json.dumps(details, ensure_ascii=False, separators=(',', ':'))}
        dynamodb.put_item(TableName=DDB_TABLE, Item=item)
    except Exception:
        pass


def _co_today_yyyy_mm_dd() -> str:
    try:
        now = int(time.time())
        return time.strftime('%Y-%m-%d', time.gmtime(now + CO_TZ_OFFSET_SECONDS))
    except Exception:
        return ''


def _today_weekday_name_co() -> str:
    try:
        now = int(time.time())
        co = now + CO_TZ_OFFSET_SECONDS
        dt = datetime.datetime.utcfromtimestamp(co)
        names = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
        return names[int(dt.weekday())]
    except Exception:
        return ''


def _normalize_weekday_name(day: str) -> str:
    try:
        d = str(day or '').strip().upper()
        if not d:
            return ''

        mapping = {
            'LUNES': 'MONDAY',
            'MARTES': 'TUESDAY',
            'MIERCOLES': 'WEDNESDAY',
            'MIÉRCOLES': 'WEDNESDAY',
            'JUEVES': 'THURSDAY',
            'VIERNES': 'FRIDAY',
            'SABADO': 'SATURDAY',
            'SÁBADO': 'SATURDAY',
            'DOMINGO': 'SUNDAY',
        }
        return mapping.get(d, d)
    except Exception:
        return ''


def _parse_schedule_list(schedule_val) -> list:
    try:
        if not isinstance(schedule_val, list):
            return []
        out = []
        for it in schedule_val:
            if not isinstance(it, dict):
                continue
            day = _normalize_weekday_name(it.get('day') or it.get('Day') or '')
            st = str(it.get('startTime') or it.get('StartTime') or '').strip()
            et = str(it.get('endTime') or it.get('EndTime') or '').strip()
            if not day or not st or not et:
                continue
            out.append({'day': day, 'startTime': st, 'endTime': et})
        return out
    except Exception:
        return []


def _derive_start_end_from_schedule(schedule: list) -> tuple[str, str]:
    try:
        if not isinstance(schedule, list) or not schedule:
            return ('', '')
        blocks = [s for s in schedule if isinstance(s, dict) and s.get('startTime') and s.get('endTime')]
        if not blocks:
            return ('', '')
        blocks_sorted = sorted(blocks, key=lambda s: str(s.get('startTime') or '99:99'))
        first = blocks_sorted[0]
        return (str(first.get('startTime') or ''), str(first.get('endTime') or ''))
    except Exception:
        return ('', '')


def _ddb_schedule(item: dict, attr: str = 'Schedule') -> list:
    try:
        v = (item.get(attr) or {})
        if not isinstance(v, dict) or 'L' not in v:
            return []
        out = []
        for row in v.get('L') or []:
            m = (row or {}).get('M') or {}
            day = _normalize_weekday_name((m.get('Day') or {}).get('S') or '')
            st = (m.get('StartTime') or {}).get('S') or ''
            et = (m.get('EndTime') or {}).get('S') or ''
            if not day or not st or not et:
                continue
            out.append({'day': day, 'startTime': st, 'endTime': et})
        return out
    except Exception:
        return []


def _get_path(event: dict) -> str:
    try:
        return (
            event.get('requestContext', {}).get('http', {}).get('path')
            or event.get('path')
            or ''
        )
    except Exception:
        return ''


def _login_fail():
    return _response(401, {
        'error': 'InvalidCredentials',
        'message': 'Correo o contraseña incorrectos.',
    })


def _login_ttl_seconds(body) -> int:
    remember = False
    if isinstance(body, dict):
        remember = bool(body.get('rememberSession') or body.get('remember'))
    if remember:
        return 60 * 60 * 24 * 30
    return 60 * 60 * 24


def _hash_password(password: str, salt_hex: str) -> str:
    return hashlib.sha256((salt_hex + password).encode('utf-8')).hexdigest()


def _new_salt_hex() -> str:
    return secrets.token_hex(16)


def _ddb_s(item: dict, key: str) -> str:
    try:
        return (item.get(key, {}) or {}).get('S') or ''
    except Exception:
        return ''


def _ddb_n(item: dict, key: str) -> str:
    try:
        return (item.get(key, {}) or {}).get('N') or ''
    except Exception:
        return ''


def _ddb_scan_all(filter_expression: str, names: dict, values: dict, limit_per_page: int = 300, max_pages: int = 25) -> list:
    items = []
    last_key = None
    for _ in range(max_pages):
        kwargs = {
            'TableName': DDB_TABLE,
            'FilterExpression': filter_expression,
            'ExpressionAttributeNames': names,
            'ExpressionAttributeValues': values,
            'Limit': int(limit_per_page),
        }
        if last_key:
            kwargs['ExclusiveStartKey'] = last_key
        resp = dynamodb.scan(**kwargs)
        items.extend((resp or {}).get('Items') or [])
        last_key = (resp or {}).get('LastEvaluatedKey')
        if not last_key:
            break
    return items


def _normalize_attendance_status(raw: str) -> str:
    st = str(raw or '').strip().lower()
    if st in ('asistencia', 'presente', 'present', 'ok'):
        return 'asistencia'
    if st in ('retardo', 'late', 'tardanza'):
        return 'retardo'
    return 'inasistencia'


def _count_student_attendance_totals(student_email: str) -> dict:
    totals = {'asistencia': 0, 'retardo': 0, 'inasistencia': 0}
    last_key = None
    try:
        for _ in range(0, 10):
            kwargs = {
                'TableName': DDB_TABLE,
                'FilterExpression': '#T = :t AND #SE = :se',
                'ExpressionAttributeNames': {'#T': 'Type', '#SE': 'StudentEmail'},
                'ExpressionAttributeValues': {
                    ':t': {'S': 'Attendance'},
                    ':se': {'S': student_email},
                },
                'Limit': 300,
            }
            if last_key:
                kwargs['ExclusiveStartKey'] = last_key
            att_scan = dynamodb.scan(**kwargs)
            for att in (att_scan or {}).get('Items') or []:
                st = _normalize_attendance_status(_ddb_s(att, 'Status'))
                totals[st] = int(totals.get(st, 0)) + 1
            last_key = (att_scan or {}).get('LastEvaluatedKey')
            if not last_key:
                break
    except Exception:
        return totals
    return totals


def _hhmm_to_minutes(raw: str):
    m = re.match(r'^(\d{1,2}):(\d{2})', str(raw or '').strip())
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2))


def _relative_time_es(created_at, now: int) -> str:
    try:
        delta = max(0, int(now) - int(created_at))
    except Exception:
        return 'Hoy'
    clock = _clock_colombia(created_at)
    if delta < 60:
        rel = 'Hace un momento'
    elif delta < 3600:
        mins = delta // 60
        rel = f'Hace {mins} min'
    elif delta < 86400:
        hours = delta // 3600
        rel = f'Hace {hours} h'
    else:
        days = delta // 86400
        rel = f'Hace {days} d'
    return f'{clock} · {rel}' if clock else rel


def _notification_from_item(item: dict, now: int) -> dict:
    created = _ddb_n(item, 'CreatedAt') or str(now)
    ntype = _ddb_s(item, 'NotifType') or _ddb_s(item, 'Kind') or 'info'
    read = False
    try:
        raw = item.get('Read') if isinstance(item, dict) else None
        if isinstance(raw, dict) and 'BOOL' in raw:
            read = bool(raw.get('BOOL'))
    except Exception:
        read = False
    return {
        'id': _ddb_s(item, 'RekognitionId'),
        'title': _ddb_s(item, 'Title') or 'Notificación',
        'message': _ddb_s(item, 'Message') or '',
        'type': ntype,
        'createdAt': int(created) if str(created).isdigit() else now,
        'time': _relative_time_es(created, now),
        'read': read,
        'classId': _ddb_s(item, 'ClassId') or None,
        'sessionId': _ddb_s(item, 'SessionId') or None,
    }


def _upsert_student_notification(
    student_email: str,
    notif_id: str,
    title: str,
    message: str,
    ntype: str,
    now: int,
    extra: dict | None = None,
    keep_created: bool = False,
) -> dict:
    prev = None
    try:
        existing = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': notif_id}},
        )
        prev = (existing or {}).get('Item')
    except Exception:
        prev = None

    if keep_created and prev:
        return _notification_from_item(prev, now)

    item = {
        'RekognitionId': {'S': notif_id},
        'Type': {'S': 'Notification'},
        'StudentEmail': {'S': student_email},
        'Title': {'S': str(title or 'Notificación')[:140]},
        'Message': {'S': str(message or '')[:500]},
        'NotifType': {'S': str(ntype or 'info')},
        'CreatedAt': {'N': str(int(now))},
        'Read': {'BOOL': False},
    }
    extra = extra or {}
    for key, val in extra.items():
        if val is None or val == '':
            continue
        item[str(key)] = {'S': str(val)}

    try:
        dynamodb.put_item(TableName=DDB_TABLE, Item=item)
    except Exception:
        logger.exception('DynamoDB put_item failed (student notification)')

    return _notification_from_item(item, now)


def _attendance_notify_copy(status: str, class_name: str, source: str = 'qr'):
    name = class_name or 'la clase'
    st = _normalize_attendance_status(status)
    if source == 'photo':
        if st == 'asistencia':
            return ('Reconocido en la foto', f'Te reconocimos en la foto de {name}. Quedaste presente.', 'success')
        if st == 'retardo':
            return ('Reconocido con retardo', f'Te reconocimos en la foto de {name}, pero quedaste con retardo.', 'warning')
        return ('No apareciste en la foto', f'El docente tomó la foto de {name} y no te reconocimos. Quedaste ausente.', 'attendance')
    if source == 'manual':
        if st == 'asistencia':
            return ('Asistencia actualizada', f'El docente te marcó presente en {name}.', 'success')
        if st == 'retardo':
            return ('Retardo actualizado', f'El docente te marcó con retardo en {name}.', 'warning')
        return ('Inasistencia actualizada', f'El docente te marcó ausente en {name}.', 'attendance')
    if st == 'asistencia':
        return ('Asistencia registrada', f'Tu asistencia en {name} quedó registrada.', 'success')
    if st == 'retardo':
        return ('Retardo registrado', f'Llegaste tarde a {name}. Quedó marcado como retardo.', 'warning')
    return ('Inasistencia registrada', f'Quedaste ausente en {name}.', 'attendance')


def _notify_student_attendance(student_email: str, session_id: str, class_id: str, class_name: str, status: str, now: int, source: str = 'qr'):
    title, msg, ntype = _attendance_notify_copy(status, class_name, source)
    return _upsert_student_notification(
        student_email,
        f'NOTIF#att#{session_id}#{student_email}'.lower(),
        title,
        msg,
        ntype,
        now,
        extra={'ClassId': class_id, 'SessionId': session_id, 'ClassName': class_name or '', 'Source': source},
        keep_created=False,
    )


def _ddb_bool(item: dict, *keys):
    """Lee un BOOL de DynamoDB. Prueba varios nombres de atributo."""
    if not isinstance(item, dict):
        return None
    for key in keys:
        raw = item.get(key)
        if not isinstance(raw, dict):
            continue
        if 'BOOL' in raw:
            return bool(raw.get('BOOL'))
        s = raw.get('S')
        if isinstance(s, str):
            low = s.strip().lower()
            if low in ('true', '1', 'yes', 'si', 'sí'):
                return True
            if low in ('false', '0', 'no'):
                return False
        n = raw.get('N')
        if n in ('1', '0'):
            return n == '1'
    return None


def _student_consent_summary(item: dict) -> dict:
    biometric = _ddb_bool(item, 'ConsentBiometric', 'BiometricConsent')
    terms = _ddb_bool(item, 'AcceptTerms')
    privacy = _ddb_bool(item, 'AcceptPrivacy')
    updated = _ddb_n(item, 'ConsentUpdatedAt') or _ddb_n(item, 'BiometricConsentUpdatedAt') or ''
    pk = _ddb_s(item, 'RekognitionId')
    has_face = bool(pk) and ('#' not in pk)
    updated_int = int(updated) if str(updated).isdigit() else None
    return {
        'acceptTerms': terms is True,
        'acceptPrivacy': privacy is True,
        'biometricConsent': biometric is True,
        'hasFace': has_face,
        'updatedAt': updated_int,
    }


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode('utf-8').rstrip('=')


def _b64url_decode(s: str) -> bytes:
    padding = '=' * ((4 - (len(s) % 4)) % 4)
    return base64.urlsafe_b64decode((s or '') + padding)


def _sign_token(payload: dict) -> str:
    if not AUTH_SECRET:
        raise RuntimeError('AuthSecretNotConfigured')
    header = {'alg': 'HS256', 'typ': 'JWT'}
    header_b64 = _b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    msg = f"{header_b64}.{payload_b64}".encode('utf-8')
    sig = hmac.new(AUTH_SECRET.encode('utf-8'), msg, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


def _verify_token(token: str) -> dict | None:
    try:
        if not AUTH_SECRET:
            return None
        parts = (token or '').split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        msg = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected = hmac.new(AUTH_SECRET.encode('utf-8'), msg, hashlib.sha256).digest()
        got = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected, got):
            return None
        payload_raw = _b64url_decode(payload_b64)
        payload = json.loads(payload_raw.decode('utf-8'))
        exp = payload.get('exp')
        if exp is not None and int(exp) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


_ES_NUM = {
    0: 'cero', 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco',
    6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez',
    11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
    16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve',
    20: 'veinte', 21: 'veintiuno', 22: 'veintidós', 24: 'veinticuatro',
    25: 'veinticinco', 27: 'veintisiete', 28: 'veintiocho', 30: 'treinta',
    32: 'treinta y dos', 35: 'treinta y cinco', 36: 'treinta y seis',
}


def _rand_int(lo: int, hi: int) -> int:
    if hi < lo:
        hi = lo
    return lo + secrets.randbelow(hi - lo + 1)


def _captcha_options(answer: int, extra: list | None = None) -> list:
    pool = set(extra or [])
    pool.add(int(answer))
    while len(pool) < 4:
        delta = _rand_int(1, 7)
        sign = 1 if secrets.randbelow(2) == 0 else -1
        cand = int(answer) + sign * delta
        if cand > 0 and cand != int(answer):
            pool.add(cand)
    opts = list(pool)
    secrets.SystemRandom().shuffle(opts)
    return opts[:4]


def _build_register_captcha() -> dict:
    kind = ['add', 'sub', 'mul', 'max', 'even', 'dots'][_rand_int(0, 5)]
    if kind == 'add':
        a, b = _rand_int(2, 9), _rand_int(2, 9)
        answer = a + b
        prompt = f'¿Cuánto es {_ES_NUM.get(a, a)} más {_ES_NUM.get(b, b)}?'
        options = _captcha_options(answer)
    elif kind == 'sub':
        a = _rand_int(6, 12)
        b = _rand_int(1, a - 1)
        answer = a - b
        prompt = f'¿Cuánto es {_ES_NUM.get(a, a)} menos {_ES_NUM.get(b, b)}?'
        options = _captcha_options(answer)
    elif kind == 'mul':
        a, b = _rand_int(2, 5), _rand_int(2, 6)
        answer = a * b
        prompt = f'¿Cuánto es {_ES_NUM.get(a, a)} por {_ES_NUM.get(b, b)}?'
        options = _captcha_options(answer)
    elif kind == 'max':
        nums = [_rand_int(2, 18) for _ in range(4)]
        while len(set(nums)) < 4:
            nums = [_rand_int(2, 18) for _ in range(4)]
        answer = max(nums)
        prompt = 'Toca el número más grande'
        options = nums
        secrets.SystemRandom().shuffle(options)
    elif kind == 'even':
        odd = [_rand_int(1, 9) * 2 + 1 for _ in range(3)]
        answer = _rand_int(2, 9) * 2
        prompt = 'Toca el único número par'
        options = odd + [answer]
        secrets.SystemRandom().shuffle(options)
    else:
        answer = _rand_int(3, 8)
        prompt = f'¿Cuántos puntos hay?  {"● " * answer}'.strip()
        options = _captcha_options(answer)
    return {'prompt': prompt, 'options': [int(x) for x in options], 'answer': int(answer)}


def _verify_register_captcha(token: str, answer) -> tuple[bool, str]:
    if not AUTH_SECRET:
        return True, ''
    payload = _verify_token(str(token or ''))
    if not payload or payload.get('role') != 'captcha':
        return False, 'CaptchaInvalid'
    now = int(time.time())
    iat = int(payload.get('iat') or 0)
    if iat and (now - iat) < 1:
        return False, 'CaptchaTooFast'
    expected = str(payload.get('ans') if payload.get('ans') is not None else '')
    got = str(answer if answer is not None else '').strip()
    if not expected or got != expected:
        return False, 'CaptchaFailed'
    return True, ''


def _parse_hhmm(hhmm: str) -> tuple[int, int] | None:
    try:
        s = (hhmm or '').strip()
        if not s:
            return None
        parts = s.split(':')
        if len(parts) != 2:
            return None
        hh = int(parts[0])
        mm = int(parts[1])
        if hh < 0 or hh > 23 or mm < 0 or mm > 59:
            return None
        return hh, mm
    except Exception:
        return None


def _scheduled_start_epoch_utc_for_today(start_time_hhmm: str) -> int | None:
    try:
        parsed = _parse_hhmm(start_time_hhmm)
        if not parsed:
            return None
        hh, mm = parsed
        now = time.time()
        # Use Colombia local day boundaries (UTC-5) to decide "today"
        t_local = time.gmtime(now + CO_TZ_OFFSET_SECONDS)
        # midnight (start of day) in Colombia, expressed as UTC epoch seconds
        midnight_utc = int(now) - (t_local.tm_hour * 3600 + t_local.tm_min * 60 + t_local.tm_sec)
        return int(midnight_utc + hh * 3600 + mm * 60)
    except Exception:
        return None


def _attendance_qr_schedule_gate(class_item: dict, now: int, action: str = 'qr') -> tuple[bool, str, dict, int | None]:
    """Allow QR/manual attendance only during today's class block (15 min before start until end)."""
    is_manual = str(action or 'qr').strip().lower() == 'manual'
    schedule_list = _ddb_schedule(class_item, 'Schedule')
    start_time = _ddb_s(class_item, 'StartTime')
    end_time = _ddb_s(class_item, 'EndTime')
    today = _today_weekday_name_co()
    if schedule_list:
        blocks = [s for s in schedule_list if str(s.get('day') or '').strip().upper() == today]
        if not blocks:
            msg = (
                f'Hoy ({today}) esta clase no tiene horario. No se puede cambiar la asistencia a mano.'
                if is_manual
                else f'Hoy ({today}) esta clase no tiene horario. El QR solo se crea en el día y hora de clase.'
            )
            return False, 'NotScheduledToday', {'today': today, 'message': msg}, None
    else:
        if not start_time:
            return False, 'InvalidStartTime', {'message': 'La clase no tiene horario configurado.'}, None
        blocks = [{'startTime': start_time, 'endTime': end_time}]

    windows = []
    for b in blocks:
        st = str(b.get('startTime') or start_time or '').strip()
        et = str(b.get('endTime') or end_time or '').strip()
        start_ep = _scheduled_start_epoch_utc_for_today(st)
        if start_ep is None:
            continue
        end_ep = _scheduled_start_epoch_utc_for_today(et) if et else None
        if end_ep is None:
            end_ep = start_ep + 2 * 3600
        elif end_ep <= start_ep:
            end_ep += 24 * 3600
        windows.append((start_ep - 15 * 60, end_ep, start_ep, st, et))

    if not windows:
        return False, 'InvalidStartTime', {'message': 'No se pudo leer la hora de inicio de la clase.'}, None

    for allow_from, end_ep, start_ep, st, et in windows:
        if allow_from <= now <= end_ep:
            return True, '', {}, start_ep

    upcoming = sorted([w for w in windows if now < w[0]], key=lambda w: w[0])
    if upcoming:
        st = upcoming[0][3]
        et = upcoming[0][4]
        rango = f'{st}–{et}' if et else st
        msg = (
            f'La asistencia manual solo se puede cambiar en el horario de clase (desde 15 min antes). Horario de hoy: {rango}.'
            if is_manual
            else f'El QR solo se puede crear en el horario de clase (desde 15 min antes). Horario de hoy: {rango}.'
        )
        return False, 'TooEarlyForQR', {'scheduledTime': st, 'message': msg}, upcoming[0][2]

    last = max(windows, key=lambda w: w[1])
    rango = f'{last[3]}–{last[4]}' if last[4] else last[3]
    msg = (
        f'El horario de clase ya terminó ({rango}). Ya no se puede cambiar la asistencia a mano.'
        if is_manual
        else f'El horario de clase ya terminó ({rango}). No se puede crear el QR de asistencia fuera de ese rango.'
    )
    return False, 'TooLateForQR', {'scheduledTime': last[3], 'message': msg}, last[2]


def _normalize_b64_image(image_b64: str) -> bytes | None:
    try:
        if not image_b64:
            return None
        s = image_b64
        if isinstance(s, str) and s.startswith('data:'):
            s = s.split(',', 1)[1]
        return base64.b64decode(s)
    except Exception:
        return None


def _get_bearer_token(event: dict) -> str:
    try:
        auth = _get_header(event, 'authorization')
        if not auth:
            return ''
        if isinstance(auth, str) and auth.lower().startswith('bearer '):
            return auth.split(' ', 1)[1].strip()
        return ''
    except Exception:
        return ''


def _attr_true(attrs: dict, key: str, min_confidence: float = 70.0) -> bool:
    item = (attrs or {}).get(key) or {}
    if not isinstance(item, dict):
        return False
    if item.get('Value') is not True:
        return False
    return float(item.get('Confidence') or 0.0) >= min_confidence


def _attr_false(attrs: dict, key: str, min_confidence: float = 70.0) -> bool:
    item = (attrs or {}).get(key) or {}
    if not isinstance(item, dict):
        return False
    if item.get('Value') is not False:
        return False
    return float(item.get('Confidence') or 0.0) >= min_confidence


def _validate_student_face(face_detail: dict):
    """Devuelve (ok, issues). issues es una lista de mensajes en español."""
    attrs = face_detail or {}
    issues = []

    confidence = float(attrs.get('Confidence') or 0.0)
    if confidence < 90:
        issues.append('El rostro no se ve con suficiente claridad. Acércate y toma otra foto.')

    bbox = attrs.get('BoundingBox') or {}
    left = float(bbox.get('Left') or 0.0)
    top = float(bbox.get('Top') or 0.0)
    width = float(bbox.get('Width') or 0.0)
    height = float(bbox.get('Height') or 0.0)
    right = left + width
    bottom = top + height
    edge = 0.045
    cropped = []
    if left < edge:
        cropped.append('a la izquierda')
    if right > (1.0 - edge):
        cropped.append('a la derecha')
    if top < edge:
        cropped.append('arriba (frente o cabello)')
    if bottom > (1.0 - edge):
        cropped.append('abajo (mentón o cuello)')
    if cropped:
        issues.append(
            'Solo se ve parte del rostro: está recortado '
            + ', '.join(cropped)
            + '. Encaja toda la cara en la foto, incluyendo frente, orejas y mentón.'
        )

    if width < 0.22 or height < 0.28:
        issues.append('El rostro se ve muy pequeño o lejos. Acércate a la cámara.')
    if width > 0.92 or height > 0.95:
        issues.append('Estás demasiado cerca y se corta la cara. Aléjate un poco.')

    cx = left + (width / 2.0)
    if abs(cx - 0.5) > 0.28:
        issues.append('Centra tu rostro en el medio de la foto.')

    if _attr_true(attrs, 'Sunglasses', 65):
        issues.append('Quítate las gafas de sol.')
    if _attr_true(attrs, 'Eyeglasses', 75):
        issues.append('Quítate las gafas para el registro biométrico.')
    if _attr_false(attrs, 'EyesOpen', 70):
        issues.append('Mantén ambos ojos abiertos y mira a la cámara.')
    if _attr_true(attrs, 'FaceOccluded', 70):
        issues.append('No te cubras la cara (mano, cubrebocas, gorro o cabello sobre ojos/boca).')
    if _attr_true(attrs, 'MouthOpen', 85):
        issues.append('Cierra la boca y mantén una expresión neutra.')

    pose = attrs.get('Pose') or {}
    yaw = abs(float(pose.get('Yaw') or 0.0))
    pitch = abs(float(pose.get('Pitch') or 0.0))
    roll = abs(float(pose.get('Roll') or 0.0))
    if yaw > 12:
        issues.append('Mira de frente: no gires la cabeza de perfil.')
    if pitch > 14:
        issues.append('No agaches ni levantes demasiado la cabeza. Mira a la cámara.')
    if roll > 18:
        issues.append('Endereza la cabeza; no la inclines hacia un lado.')

    quality = attrs.get('Quality') or {}
    brightness = float(quality.get('Brightness') or 0.0)
    sharpness = float(quality.get('Sharpness') or 0.0)
    if brightness < 45:
        issues.append('Hay poca luz. Toma la foto en un lugar más iluminado, de frente a la luz.')
    if brightness > 92:
        issues.append('Hay demasiada luz o reflejo. Evita el contraluz y pantallas brillantes detrás.')
    if sharpness < 45:
        issues.append('La foto está borrosa. Quédate quieto, enfoca y vuelve a tomar la foto.')

    return (len(issues) == 0), issues


def _register_photo_issues(face_details) -> list:
    faces = face_details or []
    if not faces:
        return ['No se detectó un rostro. Enfoca tu cara, con buena luz, y toma la foto de frente.']
    if len(faces) != 1:
        return [f'Se detectaron {len(faces)} rostros. En la foto debe aparecer solo tu cara.']
    _ok, issues = _validate_student_face(faces[0])
    return issues


def _get_header(event: dict, name: str) -> str:
    try:
        headers = event.get('headers') or {}
        if not isinstance(headers, dict):
            return ''
        for k, v in headers.items():
            if isinstance(k, str) and k.lower() == name.lower():
                return v or ''
        return ''
    except Exception:
        return ''


__all__ = [name for name in globals() if not name.startswith('__')]


