import re
import time
import unicodedata
import uuid

from runtime import *  # noqa: F401,F403

BULK_MAX_ROWS = 40

WEEKDAYS = {'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'}


def _fold_key(raw):
    text = ' '.join(str(raw or '').split())
    if not text:
        return ''
    nfd = unicodedata.normalize('NFD', text.casefold())
    return ''.join(ch for ch in nfd if unicodedata.category(ch) != 'Mn')


def _cell(row, *keys, keep_inner=False):
    if not isinstance(row, dict):
        return ''
    folded = {}
    for key, value in row.items():
        if str(key).startswith('_'):
            continue
        folded.setdefault(_fold_key(key), value)
    for key in keys:
        value = folded.get(_fold_key(key))
        if value is None:
            continue
        text = str(value or '')
        text = text.strip() if keep_inner else ' '.join(text.split())
        if text:
            return text
    return ''


def _line_of(row, index):
    try:
        n = int(row.get('line') or row.get('_line') or 0)
        if n > 0:
            return n
    except Exception:
        pass
    return index + 2


def _email_ok(email):
    return bool(re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email or ''))


def _hhmm(raw):
    match = re.match(r'^(\d{1,2}):(\d{2})$', str(raw or '').strip().replace('.', ':'))
    if not match:
        return ''
    hour = int(match.group(1))
    minute = int(match.group(2))
    if hour > 23 or minute > 59:
        return ''
    return f'{hour:02d}:{minute:02d}'


def _schedule_from_days(raw, start_time, end_time):
    if not start_time or not end_time:
        return []
    parts = re.split(r'[|,;/]+', str(raw or ''))
    out = []
    seen = set()
    for part in parts:
        day = _normalize_weekday_name(part.strip())
        if day not in WEEKDAYS or day in seen:
            continue
        seen.add(day)
        out.append({'day': day, 'startTime': start_time, 'endTime': end_time})
    return out


def _result(line, ok, status, message, **extra):
    row = {'line': line, 'ok': bool(ok), 'status': status, 'message': message}
    row.update(extra)
    return row


def _infer_kind(kind, rows):
    sample = rows[0] if rows and isinstance(rows[0], dict) else {}
    has_password = bool(_cell(sample, 'password', 'contrasena', 'contraseña', keep_inner=True))
    has_schedule = bool(
        _cell(sample, 'startTime', 'inicio', 'horaInicio')
        or _cell(sample, 'room', 'salon', 'aula')
    )
    has_email = bool(_cell(sample, 'email', 'correo', 'correoEstudiante'))
    has_class = bool(_cell(sample, 'clase', 'asignatura', 'className'))
    has_teacher = bool(_cell(sample, 'teacherEmail', 'docente', 'correoDocente'))
    if has_email and (has_class or has_teacher) and not has_password and not has_schedule:
        return 'estudiantes'
    if has_schedule and not has_password:
        return 'asignaturas'
    if has_password:
        return 'docentes'
    return kind


def _kind_from_body(body):
    raw = _fold_key((body or {}).get('kind') or (body or {}).get('tipo') or '')
    if raw in ('docente', 'docentes', 'teacher', 'teachers'):
        return 'docentes'
    if raw in ('asignatura', 'asignaturas', 'clase', 'clases', 'class', 'classes'):
        return 'asignaturas'
    if raw in ('estudiante', 'estudiantes', 'student', 'students', 'matricula'):
        return 'estudiantes'
    return ''


def handle_admin_bulk_import(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    admin_email = str(payload.get('sub') or '').strip().lower()
    kind = _kind_from_body(body if isinstance(body, dict) else {})
    if not kind:
        return _response(400, {
            'error': 'InvalidKind',
            'message': 'El tipo debe ser docentes, asignaturas o estudiantes.',
        })

    rows = (body or {}).get('rows') if isinstance(body, dict) else None
    if not isinstance(rows, list) or not rows:
        return _response(400, {'error': 'MissingRows', 'message': 'El archivo no tiene filas para cargar.'})
    if len(rows) > BULK_MAX_ROWS:
        return _response(400, {
            'error': 'TooManyRows',
            'message': f'El archivo puede tener hasta {BULK_MAX_ROWS} filas por carga.',
        })

    kind = _infer_kind(kind, rows)
    if kind == 'docentes':
        results = [_import_teacher(admin_email, row, i) for i, row in enumerate(rows)]
    elif kind == 'asignaturas':
        results = _import_classes(rows)
    else:
        results = _import_enrollments(rows)

    created = sum(1 for row in results if row.get('status') == 'created')
    skipped = sum(1 for row in results if row.get('status') == 'skipped')
    failed = sum(1 for row in results if not row.get('ok'))
    _audit_log(admin_email, 'admin', 'admin-bulk-import', {
        'kind': kind,
        'created': created,
        'skipped': skipped,
        'failed': failed,
    })
    return _response(200, {
        'ok': failed == 0,
        'kind': kind,
        'created': created,
        'skipped': skipped,
        'failed': failed,
        'results': results,
    })


def _import_teacher(admin_email, row, index):
    line = _line_of(row, index)
    full_name = _cell(row, 'fullName', 'nombre', 'nombreDocente', 'name')
    email = _cell(row, 'email', 'correo').lower()
    password = _cell(row, 'password', 'contrasena', 'contraseña', keep_inner=True)
    teacher_code = _cell(row, 'teacherCode', 'codigo', 'codigoDocente')

    if not full_name or not email or not password:
        return _result(line, False, 'error', 'Faltan nombre, correo o contraseña.')
    if not _email_ok(email):
        return _result(line, False, 'error', 'El correo no es válido.', email=email)
    issue = _password_issue(password)
    if issue:
        return _result(line, False, 'error', issue[1], email=email)

    salt_hex = _new_salt_hex()
    item = {
        'RekognitionId': {'S': f'USER#{email}'},
        'FullName': {'S': full_name},
        'Email': {'S': email},
        'Role': {'S': 'teacher'},
        'PasswordSalt': {'S': salt_hex},
        'PasswordHash': {'S': _hash_password(password, salt_hex)},
        'MustChangePassword': {'BOOL': True},
        'AcceptTerms': {'BOOL': False},
        'AcceptPrivacy': {'BOOL': False},
    }
    if teacher_code:
        item['TeacherCode'] = {'S': teacher_code[:40]}

    try:
        dynamodb.put_item(
            TableName=DDB_TABLE,
            Item=item,
            ConditionExpression='attribute_not_exists(RekognitionId)',
        )
    except Exception as exc:
        if 'ConditionalCheckFailed' in str(exc):
            return _result(line, False, 'error', 'Ese correo ya tiene una cuenta.', email=email)
        logger.exception('DynamoDB put_item failed (bulk teacher)')
        return _result(line, False, 'error', 'No se pudo guardar el docente.', email=email)

    now = int(time.time())
    try:
        _upsert_student_notification(
            email,
            f'NOTIF#pwdsetup#{email}'.lower(),
            'Cambia tu contraseña',
            'Tu cuenta de docente ya está creada. Entra con la contraseña temporal y cámbiala antes de continuar.',
            'warning',
            now,
            extra={'Action': 'change-password'},
        )
    except Exception:
        logger.exception('bulk teacher notification failed')

    _send_text_email(
        email,
        'Tu cuenta de docente ya está creada',
        (
            f'Hola {full_name},\n\n'
            'Tu cuenta de docente en Toma Asistencia UMB ya fue creada.\n'
            'Entra con la contraseña temporal que te entregó el administrador y cámbiala al iniciar sesión.\n'
            'Este correo no incluye la contraseña.\n'
        ),
    )
    return _result(line, True, 'created', 'Docente creado.', email=email, fullName=full_name)


def _load_classes():
    items = _ddb_scan_all(
        '#T = :t',
        {'#T': 'Type'},
        {':t': {'S': 'Class'}},
    ) or []
    by_id = {}
    by_key = {}
    for item in items:
        class_id = (_ddb_s(item, 'ClassId') or '').strip()
        if class_id:
            by_id[class_id] = item
        key = (
            _fold_key(_ddb_s(item, 'ClassName')),
            _fold_key(_ddb_s(item, 'Group')),
            (_ddb_s(item, 'TeacherEmail') or '').strip().lower(),
        )
        by_key.setdefault(key, []).append(item)
    return by_id, by_key


def _teacher_exists(email):
    try:
        resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f'USER#{email}'}},
        )
    except Exception:
        logger.exception('DynamoDB get_item failed (bulk teacher lookup)')
        return False
    item = (resp or {}).get('Item')
    return bool(item) and (_ddb_s(item, 'Role') or '').strip().lower() == 'teacher'


def _import_classes(rows):
    _, by_key = _load_classes()
    results = []
    for index, row in enumerate(rows):
        line = _line_of(row, index)
        class_name = _cell(row, 'className', 'nombre', 'asignatura', 'clase', 'nombreClase')
        group = _cell(row, 'group', 'grupo')
        start_time = _hhmm(_cell(row, 'startTime', 'inicio', 'horaInicio'))
        end_time = _hhmm(_cell(row, 'endTime', 'fin', 'horaFin'))
        room = _cell(row, 'room', 'salon', 'aula', 'classroom')[:60]
        teacher_email = _cell(row, 'teacherEmail', 'docente', 'correoDocente').lower()
        subject_code = _cell(row, 'subjectCode', 'codigo', 'codigoAsignatura')
        period = _cell(row, 'period', 'periodo')
        days = _cell(row, 'days', 'dias', keep_inner=True)

        if not class_name or not group or not start_time or not end_time or not room or not teacher_email:
            results.append(_result(line, False, 'error', 'Faltan nombre, grupo, horario, salón o correo del docente.'))
            continue
        if not _email_ok(teacher_email):
            results.append(_result(line, False, 'error', 'El correo del docente no es válido.', email=teacher_email))
            continue
        if start_time >= end_time:
            results.append(_result(line, False, 'error', 'La hora de inicio debe ser anterior a la de fin.'))
            continue
        if not _teacher_exists(teacher_email):
            results.append(_result(line, False, 'error', 'No hay un docente con ese correo.', email=teacher_email))
            continue

        class_id, id_error = _class_id_for(subject_code, group)
        if id_error:
            results.append(_result(line, False, 'error', id_error, email=teacher_email))
            continue
        group = _normalize_group(group)

        key = (_fold_key(class_name), _fold_key(group), teacher_email)
        if by_key.get(key):
            results.append(_result(line, True, 'skipped', 'Esa asignatura ya existe para ese docente y grupo.', email=teacher_email))
            continue

        schedule = _schedule_from_days(days, start_time, end_time)
        now = int(time.time())
        item = {
            'RekognitionId': {'S': f'CLASS#{class_id}'},
            'Type': {'S': 'Class'},
            'ClassId': {'S': class_id},
            'ClassName': {'S': class_name},
            'Group': {'S': group},
            'StartTime': {'S': start_time},
            'EndTime': {'S': end_time},
            'Room': {'S': room},
            'TeacherEmail': {'S': teacher_email},
            'CreatedAt': {'N': str(now)},
        }
        item['SubjectCode'] = {'S': subject_code}
        if period:
            item['Period'] = {'S': period[:40]}
        if schedule:
            item['Schedule'] = {
                'L': [
                    {'M': {
                        'Day': {'S': block['day']},
                        'StartTime': {'S': block['startTime']},
                        'EndTime': {'S': block['endTime']},
                    }}
                    for block in schedule
                ]
            }
        try:
            dynamodb.put_item(TableName=DDB_TABLE, Item=item, ConditionExpression='attribute_not_exists(RekognitionId)')
        except Exception as exc:
            if 'ConditionalCheckFailed' in str(exc):
                results.append(_result(line, True, 'skipped', f'Ya existe una clase con el código {class_id}.', email=teacher_email))
                continue
            logger.exception('DynamoDB put_item failed (bulk class)')
            results.append(_result(line, False, 'error', 'No se pudo guardar la asignatura.'))
            continue

        by_key.setdefault(key, []).append(item)
        results.append(_result(
            line,
            True,
            'created',
            'Asignatura creada.',
            classId=class_id,
            className=class_name,
            email=teacher_email,
        ))
    return results


def _load_students():
    items = _ddb_scan_all(
        '(#R = :r) OR (#T = :t)',
        {'#R': 'Role', '#T': 'Type'},
        {':r': {'S': 'student'}, ':t': {'S': 'Student'}},
    ) or []
    by_email = {}
    for item in items:
        email = (_ddb_s(item, 'Email') or '').strip().lower()
        if email:
            by_email[email] = item
    return by_email


def _find_class(by_id, by_key, class_id, class_name, group, teacher_email):
    if class_id and class_id in by_id:
        return by_id[class_id], ''
    if not class_name or not teacher_email:
        return None, 'Indica la clase y el correo del docente, o el identificador de la clase.'
    exact = by_key.get((_fold_key(class_name), _fold_key(group), teacher_email)) or []
    if len(exact) == 1:
        return exact[0], ''
    if len(exact) > 1:
        return None, 'Hay varias clases con esos datos. Revisa el grupo.'
    if group:
        return None, 'No encontré esa asignatura para ese docente y grupo.'
    loose = []
    name_key = _fold_key(class_name)
    for (name, _group, email), items in by_key.items():
        if name == name_key and email == teacher_email:
            loose.extend(items)
    if len(loose) == 1:
        return loose[0], ''
    if len(loose) > 1:
        return None, 'Hay varias clases con ese nombre. Indica el grupo.'
    return None, 'No encontré esa asignatura para ese docente.'


def _import_enrollments(rows):
    by_id, by_key = _load_classes()
    students = _load_students()
    results = []
    for index, row in enumerate(rows):
        line = _line_of(row, index)
        email = _cell(row, 'email', 'correo', 'correoEstudiante').lower()
        class_id = _cell(row, 'classId', 'claseId')
        class_name = _cell(row, 'clase', 'asignatura', 'className')
        group = _cell(row, 'group', 'grupo')
        teacher_email = _cell(row, 'teacherEmail', 'docente', 'correoDocente').lower()

        if not email:
            results.append(_result(line, False, 'error', 'Falta el correo del estudiante.'))
            continue
        if not _email_ok(email):
            results.append(_result(line, False, 'error', 'El correo del estudiante no es válido.', email=email))
            continue
        student = students.get(email)
        if not student:
            results.append(_result(
                line,
                False,
                'error',
                'Ese estudiante aún no tiene cuenta. Debe registrarse con su foto antes de inscribirlo.',
                email=email,
            ))
            continue

        class_item, find_error = _find_class(by_id, by_key, class_id, class_name, group, teacher_email)
        if not class_item:
            results.append(_result(line, False, 'error', find_error, email=email))
            continue

        found_id = (_ddb_s(class_item, 'ClassId') or class_id).strip()
        found_teacher = (_ddb_s(class_item, 'TeacherEmail') or teacher_email).strip().lower()
        found_name = _ddb_s(class_item, 'ClassName') or class_name
        enroll_pk = f'ENROLL#{found_id}#{email}'
        try:
            existing = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': enroll_pk}},
            )
        except Exception:
            logger.exception('DynamoDB get_item failed (bulk enrollment)')
            results.append(_result(line, False, 'error', 'No se pudo revisar si ya estaba inscrito.', email=email))
            continue
        if (existing or {}).get('Item'):
            results.append(_result(line, True, 'skipped', 'El estudiante ya está en esa clase.', email=email, className=found_name))
            continue

        student_name = _display_person_name(_ddb_s(student, 'FullName'))
        student_code = (_ddb_s(student, 'StudentCode') or '').strip()
        now = int(time.time())
        enroll_item = {
            'RekognitionId': {'S': enroll_pk},
            'Type': {'S': 'Enrollment'},
            'ClassId': {'S': found_id},
            'TeacherEmail': {'S': found_teacher},
            'StudentEmail': {'S': email},
            'JoinedAt': {'N': str(now)},
        }
        if student_name:
            enroll_item['StudentName'] = {'S': student_name}
        if student_code:
            enroll_item['StudentCode'] = {'S': student_code}
        try:
            dynamodb.put_item(
                TableName=DDB_TABLE,
                Item=enroll_item,
                ConditionExpression='attribute_not_exists(RekognitionId)',
            )
        except Exception as exc:
            if 'ConditionalCheckFailed' in str(exc):
                results.append(_result(line, True, 'skipped', 'El estudiante ya está en esa clase.', email=email))
                continue
            logger.exception('DynamoDB put_item failed (bulk enrollment)')
            results.append(_result(line, False, 'error', 'No se pudo inscribir al estudiante.', email=email))
            continue

        try:
            _upsert_student_notification(
                email,
                f'NOTIF#enroll#{found_id}#{email}'.lower(),
                'Nueva clase',
                f'Te inscribieron en {found_name}.',
                'info',
                now,
            )
        except Exception:
            logger.exception('bulk enrollment notification failed')

        results.append(_result(line, True, 'created', 'Estudiante inscrito.', email=email, className=found_name))
    return results
