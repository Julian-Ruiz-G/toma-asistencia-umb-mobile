from runtime import *  # noqa: F401,F403

def _first_s(item, *keys):
    for k in keys:
        v = (_ddb_s(item, k) or '').strip()
        if v:
            return v
    return ''


def handle_admin_students(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    try:
        items = _ddb_scan_all(
            '(#R = :r) OR (#T = :t)',
            {'#R': 'Role', '#T': 'Type'},
            {':r': {'S': 'student'}, ':t': {'S': 'Student'}},
        )
    except Exception as e:
        logger.exception('DynamoDB scan failed (admin-students)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    items = items or []
    out = []
    for it in items:
        email = _ddb_s(it, 'Email') or None
        full_name = _ddb_s(it, 'FullName') or None
        student_code = _ddb_s(it, 'StudentCode') or None
        flags = _student_consent_summary(it)
        out.append({
            'email': email,
            'fullName': full_name,
            'studentCode': student_code,
            'program': _first_s(it, 'Program', 'Carrera', 'Career') or None,
            'semester': _first_s(it, 'Semester', 'Semestre') or None,
            'phone': _first_s(it, 'Phone', 'Telefono', 'Tel') or None,
            'acceptTerms': flags['acceptTerms'],
            'acceptPrivacy': flags['acceptPrivacy'],
            'biometricConsent': flags['biometricConsent'],
            'hasFace': flags['hasFace'],
            'biometricConsentUpdatedAt': flags['updatedAt'],
        })

    out = sorted(out, key=lambda x: str(x.get('email') or ''))
    return _response(200, {'ok': True, 'students': out})

def handle_admin_students_by_class(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    try:
        enroll_scan = _ddb_scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t',
            ExpressionAttributeNames={'#T': 'Type'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}},
        )
        enroll_items = (enroll_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (admin-students-by-class enrollments)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    by_class = {}
    class_ids = set()
    for en in enroll_items:
        cid = (_ddb_s(en, 'ClassId') or '').strip()
        if not cid:
            continue
        class_ids.add(cid)
        by_class.setdefault(cid, []).append({
            'studentEmail': (_ddb_s(en, 'StudentEmail') or '').strip().lower() or None,
            'studentName': _ddb_s(en, 'StudentName') or None,
            'studentCode': _ddb_s(en, 'StudentCode') or None,
            'teacherEmail': (_ddb_s(en, 'TeacherEmail') or '').strip().lower() or None,
        })

    class_meta = {}
    for cid in class_ids:
        try:
            c_resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': f"CLASS#{cid}"}})
            c_it = (c_resp or {}).get('Item')
        except Exception:
            c_it = None
        if c_it:
            class_meta[cid] = {
                'classId': cid,
                'className': _ddb_s(c_it, 'ClassName') or None,
                'group': _ddb_s(c_it, 'Group') or None,
                'teacherEmail': (_ddb_s(c_it, 'TeacherEmail') or '').strip().lower() or None,
                'subjectCode': _ddb_s(c_it, 'SubjectCode') or None,
                'period': _ddb_s(c_it, 'Period') or None,
            }
        else:
            class_meta[cid] = {'classId': cid}

    classes = []
    for cid, roster in by_class.items():
        classes.append({
            'class': class_meta.get(cid) or {'classId': cid},
            'students': sorted(roster, key=lambda s: str(s.get('studentEmail') or '')),
            'studentsCount': len(roster),
        })

    classes = sorted(classes, key=lambda x: (str((x.get('class') or {}).get('className') or ''), str((x.get('class') or {}).get('classId') or '')))
    return _response(200, {'ok': True, 'classes': classes})

def handle_admin_classes(event, body):
    """Todas las clases con docente, horario, estudiantes, sesiones y resumen de asistencia."""
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    try:
        class_items = _ddb_scan_all('#T = :t', {'#T': 'Type'}, {':t': {'S': 'Class'}})
        enroll_items = _ddb_scan_all('#T = :t', {'#T': 'Type'}, {':t': {'S': 'Enrollment'}})
        session_items = _ddb_scan_all('#T = :t', {'#T': 'Type'}, {':t': {'S': 'AttendanceSession'}})
        attendance_items = _ddb_scan_all('#T = :t', {'#T': 'Type'}, {':t': {'S': 'Attendance'}})
        teacher_items = _ddb_scan_all('#R = :r', {'#R': 'Role'}, {':r': {'S': 'teacher'}})
    except Exception as e:
        logger.exception('DynamoDB scan failed (admin-classes)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    teacher_names = {}
    for t in teacher_items:
        te = (_ddb_s(t, 'Email') or '').strip().lower()
        if te:
            teacher_names[te] = _ddb_s(t, 'FullName') or None

    students_by_class = {}
    for en in enroll_items:
        cid = (_ddb_s(en, 'ClassId') or '').strip()
        if not cid:
            continue
        students_by_class.setdefault(cid, []).append({
            'email': (_ddb_s(en, 'StudentEmail') or '').strip().lower() or None,
            'name': _display_person_name(_ddb_s(en, 'StudentName')) or None,
            'code': _ddb_s(en, 'StudentCode') or None,
        })

    sessions_by_class = {}
    for se in session_items:
        cid = (_ddb_s(se, 'ClassId') or '').strip()
        if cid:
            sessions_by_class.setdefault(cid, []).append(_ddb_s(se, 'SessionDate') or '')

    attendance_by_class = {}
    for at in attendance_items:
        cid = (_ddb_s(at, 'ClassId') or '').strip()
        if not cid:
            continue
        bucket = attendance_by_class.setdefault(cid, {'asistencia': 0, 'retardo': 0, 'inasistencia': 0})
        status = _normalize_attendance_status(_ddb_s(at, 'Status'))
        if status in bucket:
            bucket[status] += 1

    classes = []
    for c in class_items:
        cid = (_ddb_s(c, 'ClassId') or '').strip()
        if not cid:
            continue
        te = (_ddb_s(c, 'TeacherEmail') or '').strip().lower()
        att = attendance_by_class.get(cid) or {'asistencia': 0, 'retardo': 0, 'inasistencia': 0}
        att_total = sum(int(v) for v in att.values())
        dates = sorted(d for d in sessions_by_class.get(cid, []) if d)
        roster = sorted(
            students_by_class.get(cid, []),
            key=lambda r: str(r.get('name') or r.get('email') or '').lower(),
        )
        start_time = _ddb_s(c, 'StartTime')
        end_time = _ddb_s(c, 'EndTime')
        classes.append({
            'classId': cid,
            'className': _ddb_s(c, 'ClassName') or None,
            'group': _ddb_s(c, 'Group') or None,
            'subjectCode': _ddb_s(c, 'SubjectCode') or None,
            'period': _ddb_s(c, 'Period') or None,
            'room': (_ddb_s(c, 'Room') or '').strip() or None,
            'startTime': start_time or None,
            'endTime': end_time or None,
            'schedule': _ddb_schedule(c, 'Schedule'),
            'teacherEmail': te or None,
            'teacherName': teacher_names.get(te),
            'studentsCount': len(roster),
            'students': roster,
            'sessionsCount': len(dates),
            'lastSessionDate': dates[-1] if dates else None,
            'attendance': {
                **att,
                'total': att_total,
                # Asistencia efectiva: presentes + retardos sobre el total registrado.
                'rate': round((att['asistencia'] + att['retardo']) * 100 / att_total) if att_total else None,
            },
        })

    classes.sort(key=lambda x: (str(x.get('className') or '').lower(), str(x.get('group') or '')))
    return _response(200, {'ok': True, 'classes': classes})


def _add_temp_password_update(new_password: str, updates: list, names: dict, vals: dict):
    """Contraseña temporal puesta por el admin (la recuperación de cuentas pasa por el admin).
    El usuario debe cambiarla al entrar. Devuelve una respuesta de error o None."""
    issue = _password_issue(new_password)
    if issue:
        return _response(400, {'error': issue[0], 'message': issue[1]})
    salt_hex = _new_salt_hex()
    updates.extend(['#PS = :ps', '#PH = :ph', '#MCP = :mcp'])
    names.update({'#PS': 'PasswordSalt', '#PH': 'PasswordHash', '#MCP': 'MustChangePassword'})
    vals.update({
        ':ps': {'S': salt_hex},
        ':ph': {'S': _hash_password(new_password, salt_hex)},
        ':mcp': {'BOOL': True},
    })
    return None


def handle_admin_update_student(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    admin_email = str(payload.get('sub') or '').strip().lower()

    email = (body.get('email') or body.get('correo') or '').strip().lower()
    full_name = (body.get('fullName') or body.get('nombre') or body.get('nombreCompleto') or '').strip()
    student_code = (body.get('studentCode') or body.get('codigoEstudiante') or '').strip()
    new_password = (body.get('password') or body.get('contrasena') or '').strip()

    if not email:
        return _response(400, {'error': 'Missing field: email'})

    item = _scan_find_user_by_email(email, roles=['student'], types=['Student'])
    if not item:
        return _response(404, {'error': 'StudentNotFound'})

    pk = _ddb_s(item, 'RekognitionId')
    if not pk:
        return _response(500, {'error': 'StudentKeyMissing'})

    updates = []
    names = {}
    vals = {}
    if full_name:
        updates.append('#FN = :fn')
        names['#FN'] = 'FullName'
        vals[':fn'] = {'S': full_name}
    if student_code:
        updates.append('#SC = :sc')
        names['#SC'] = 'StudentCode'
        vals[':sc'] = {'S': student_code}
    if new_password:
        error = _add_temp_password_update(new_password, updates, names, vals)
        if error:
            return error

    if not updates:
        return _response(400, {'error': 'NoUpdates'})

    try:
        dynamodb.update_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': pk}},
            UpdateExpression='SET ' + ', '.join(updates),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=vals,
        )
    except Exception as e:
        logger.exception('DynamoDB update_item failed (admin-update-student)')
        return _response(500, {'error': 'DynamoDBUpdateFailed', 'details': str(e)})

    _audit_log(admin_email, 'admin', 'admin-update-student', {'studentEmail': email, 'passwordReset': bool(new_password)})
    return _response(200, {'ok': True})

def handle_admin_delete_student(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    admin_email = str(payload.get('sub') or '').strip().lower()

    email = (body.get('email') or body.get('correo') or '').strip().lower()
    if not email:
        return _response(400, {'error': 'Missing field: email'})

    item = _scan_find_user_by_email(email, roles=['student'], types=['Student'])
    if not item:
        return _response(404, {'error': 'StudentNotFound'})

    pk = _ddb_s(item, 'RekognitionId')
    if not pk:
        return _response(500, {'error': 'StudentKeyMissing'})

    face_result = {'ok': True, 'deleted': [], 'skipped': True}
    if _looks_like_face_id(pk):
        face_result = _delete_faces_from_collection([pk])
        if not face_result.get('ok'):
            return _response(500, {
                'error': 'RekognitionDeleteFailed',
                'message': 'No se pudo eliminar el rostro de la colección. El estudiante no se borró.',
                'details': face_result.get('error'),
            })

    related_deleted = 0
    try:
        related_deleted = _delete_related_items_by_student_email(email)
    except Exception:
        logger.exception('Related student records delete failed (admin-delete-student)')

    try:
        dynamodb.delete_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': pk}})
    except Exception as e:
        logger.exception('DynamoDB delete_item failed (admin-delete-student)')
        return _response(500, {'error': 'DynamoDBDeleteFailed', 'details': str(e)})

    _audit_log(admin_email, 'admin', 'admin-delete-student', {
        'studentEmail': email,
        'faceId': pk,
        'facesDeleted': face_result.get('deleted'),
        'relatedDeleted': related_deleted,
    })
    return _response(200, {
        'ok': True,
        'email': email,
        'faceId': pk,
        'collection': COLLECTION,
        'facesDeleted': face_result.get('deleted') or [],
        'relatedRecordsDeleted': related_deleted,
    })

def handle_admin_teachers(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    try:
        users_scan = _ddb_scan(
            TableName=DDB_TABLE,
            FilterExpression='(#R = :r) OR (#T = :t)',
            ExpressionAttributeNames={'#R': 'Role', '#T': 'Type'},
            ExpressionAttributeValues={':r': {'S': 'teacher'}, ':t': {'S': 'Teacher'}},
        )
        teacher_users = (users_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (admin-teachers users)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    try:
        class_scan = _ddb_scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t',
            ExpressionAttributeNames={'#T': 'Type'},
            ExpressionAttributeValues={':t': {'S': 'Class'}},
        )
        class_items = (class_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (admin-teachers classes)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    classes_by_teacher = {}
    for c in class_items:
        te = (_ddb_s(c, 'TeacherEmail') or '').strip().lower()
        if not te:
            continue
        classes_by_teacher.setdefault(te, []).append({
            'classId': _ddb_s(c, 'ClassId') or None,
            'className': _ddb_s(c, 'ClassName') or None,
            'group': _ddb_s(c, 'Group') or None,
            'subjectCode': _ddb_s(c, 'SubjectCode') or None,
            'period': _ddb_s(c, 'Period') or None,
            'startTime': _ddb_s(c, 'StartTime') or None,
            'endTime': _ddb_s(c, 'EndTime') or None,
        })

    out = []
    seen_email = set()
    for tu in teacher_users:
        pk = (_ddb_s(tu, 'RekognitionId') or '').strip()
        te = (_ddb_s(tu, 'Email') or '').strip().lower()
        if not te and pk.upper().startswith('USER#'):
            te = pk.split('#', 1)[-1].strip().lower()
        role = (_ddb_s(tu, 'Role') or '').strip().lower()
        typ = (_ddb_s(tu, 'Type') or '').strip()
        if role and role != 'teacher' and typ != 'Teacher':
            continue
        if not role and typ != 'Teacher':
            continue
        if te and te in seen_email:
            continue
        if te:
            seen_email.add(te)
        terms = _ddb_bool(tu, 'AcceptTerms')
        privacy = _ddb_bool(tu, 'AcceptPrivacy')
        out.append({
            'id': pk or None,
            'email': te or None,
            'fullName': _ddb_s(tu, 'FullName') or None,
            'teacherCode': _ddb_s(tu, 'TeacherCode') or None,
            'classes': classes_by_teacher.get(te, []),
            'subjectsCount': len(classes_by_teacher.get(te, [])),
            'acceptTerms': terms is True,
            'acceptPrivacy': privacy is True,
        })

    out = sorted(out, key=lambda x: str(x.get('email') or ''))
    return _response(200, {'ok': True, 'teachers': out})

def handle_admin_update_teacher(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    admin_email = str(payload.get('sub') or '').strip().lower()

    email = (body.get('email') or body.get('correo') or '').strip().lower()
    full_name = (body.get('fullName') or body.get('nombre') or body.get('nombreCompleto') or '').strip()
    teacher_code = (body.get('teacherCode') or body.get('codigoDocente') or '').strip()
    new_password = (body.get('password') or body.get('contrasena') or '').strip()

    if not email:
        return _response(400, {'error': 'Missing field: email'})

    item = _scan_find_user_by_email(email, roles=['teacher'], types=['Teacher'])
    if not item:
        return _response(404, {'error': 'TeacherNotFound'})

    pk = _ddb_s(item, 'RekognitionId')
    if not pk:
        return _response(500, {'error': 'TeacherKeyMissing'})

    updates = []
    names = {}
    vals = {}
    if full_name:
        updates.append('#FN = :fn')
        names['#FN'] = 'FullName'
        vals[':fn'] = {'S': full_name}
    if teacher_code:
        updates.append('#TC = :tc')
        names['#TC'] = 'TeacherCode'
        vals[':tc'] = {'S': teacher_code}
    if new_password:
        error = _add_temp_password_update(new_password, updates, names, vals)
        if error:
            return error

    if not updates:
        return _response(400, {'error': 'NoUpdates'})

    try:
        dynamodb.update_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': pk}},
            UpdateExpression='SET ' + ', '.join(updates),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=vals,
        )
    except Exception as e:
        logger.exception('DynamoDB update_item failed (admin-update-teacher)')
        return _response(500, {'error': 'DynamoDBUpdateFailed', 'details': str(e)})

    _audit_log(admin_email, 'admin', 'admin-update-teacher', {'teacherEmail': email, 'passwordReset': bool(new_password)})
    return _response(200, {'ok': True})

def handle_admin_delete_teacher(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    admin_email = str(payload.get('sub') or '').strip().lower()

    email = (body.get('email') or body.get('correo') or '').strip().lower()
    pk_req = str((body.get('id') or body.get('rekognitionId') or '')).strip()
    if not email and not pk_req:
        return _response(400, {'error': 'Missing field: email'})

    item = None
    if email:
        try:
            got = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': f'USER#{email}'}},
            )
            cand = (got or {}).get('Item')
            if cand and (_ddb_s(cand, 'Role') or '').strip().lower() == 'teacher':
                item = cand
        except Exception:
            item = None
        if not item:
            item = _scan_find_user_by_email(email, roles=['teacher'], types=['Teacher'])
    if not item and pk_req:
        try:
            got = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': pk_req}})
            cand = (got or {}).get('Item')
        except Exception as e:
            logger.exception('DynamoDB get_item failed (admin-delete-teacher)')
            return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})
        role = (_ddb_s(cand, 'Role') or '').strip().lower() if cand else ''
        typ = (_ddb_s(cand, 'Type') or '').strip() if cand else ''
        if cand and (role == 'teacher' or typ == 'Teacher'):
            item = cand

    if not item:
        return _response(404, {'error': 'TeacherNotFound'})

    pk = _ddb_s(item, 'RekognitionId')
    if not pk:
        return _response(500, {'error': 'TeacherKeyMissing'})

    try:
        dynamodb.delete_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': pk}})
    except Exception as e:
        logger.exception('DynamoDB delete_item failed (admin-delete-teacher)')
        return _response(500, {'error': 'DynamoDBDeleteFailed', 'details': str(e)})

    _audit_log(admin_email, 'admin', 'admin-delete-teacher', {'teacherEmail': email})
    return _response(200, {'ok': True})

def handle_admin_logs(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    limit = 200
    try:
        req_limit = int((body.get('limit') if isinstance(body, dict) else None) or limit)
        limit = max(1, min(500, req_limit))
    except Exception:
        limit = 200

    try:
        scan_resp = _ddb_scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t',
            ExpressionAttributeNames={'#T': 'Type'},
            ExpressionAttributeValues={':t': {'S': 'AuditLog'}},
        )
    except Exception as e:
        logger.exception('DynamoDB scan failed (admin-logs)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    items = (scan_resp or {}).get('Items') or []
    logs = []
    for it in items:
        raw_details = _ddb_s(it, 'Details')
        try:
            details = json.loads(raw_details) if raw_details else None
        except Exception:
            details = raw_details or None
        logs.append({
            'id': _ddb_s(it, 'RekognitionId') or None,
            'createdAt': _ddb_n(it, 'CreatedAt') or None,
            'action': _ddb_s(it, 'Action') or None,
            'actorEmail': _ddb_s(it, 'ActorEmail') or None,
            'actorRole': _ddb_s(it, 'ActorRole') or None,
            'details': details,
        })

    logs = sorted(logs, key=lambda x: int(x.get('createdAt') or 0), reverse=True)[:limit]
    return _response(200, {'ok': True, 'logs': logs})

def handle_admin_consents(event, body):
    action = str((body or {}).get('action') or '').strip().lower().replace('_', '-')
    if action in ('request-profile', 'admin-request-profile'):
        return handle_admin_request_profile(event, body)

    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    if action in ('request-all', 'request-all-consents'):
        return _handle_request_all_consents(str(payload.get('sub') or '').strip().lower(), body)

    try:
        users = _consent_users('all')
    except Exception as e:
        logger.exception('DynamoDB scan failed (admin-consents)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    rows = []
    for role, it in users:
        flags = _student_consent_summary(it)
        missing = [k for k, _ in _profile_missing(it, role, consents_only=True)]
        rows.append({
            'role': role,
            'email': _ddb_s(it, 'Email') or None,
            'fullName': _ddb_s(it, 'FullName') or None,
            'studentCode': _ddb_s(it, 'StudentCode') or None,
            'teacherCode': _ddb_s(it, 'TeacherCode') or None,
            'status': 'approved' if not missing else 'pending',
            'missing': missing,
            'acceptTerms': flags['acceptTerms'],
            'acceptPrivacy': flags['acceptPrivacy'],
            # Los docentes no registran rostro: la biometría no aplica.
            'biometricConsent': flags['biometricConsent'] if role == 'student' else None,
            'hasFace': flags['hasFace'] if role == 'student' else None,
            'updatedAt': flags['updatedAt'],
        })

    rows = sorted(rows, key=lambda x: (x['role'] != 'student', str(x.get('fullName') or x.get('email') or '').lower()))
    return _response(200, {'ok': True, 'consents': rows})

def handle_admin_create_teacher(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    admin_email = str(payload.get('sub') or '').strip().lower()

    teacher_code = (body.get('teacherCode') or body.get('codigoDocente') or '').strip()
    full_name = (body.get('fullName') or body.get('nombreDocente') or '').strip()
    email = (body.get('email') or body.get('correo') or '').strip().lower()
    password = (body.get('password') or body.get('contrasena') or '').strip()

    if not full_name or not email or not password:
        return _response(400, {'error': 'Missing fields: fullName, email, password'})

    salt_hex = _new_salt_hex()
    pw_hash = _hash_password(password, salt_hex)

    pk = f"USER#{email}"
    item = {
        'RekognitionId': {'S': pk},
        'FullName': {'S': full_name},
        'Email': {'S': email},
        'Role': {'S': 'teacher'},
        'PasswordSalt': {'S': salt_hex},
        'PasswordHash': {'S': pw_hash},
        'MustChangePassword': {'BOOL': True},
        'AcceptTerms': {'BOOL': False},
        'AcceptPrivacy': {'BOOL': False},
    }
    if teacher_code:
        item['TeacherCode'] = {'S': teacher_code}

    try:
        dynamodb.put_item(
            TableName=DDB_TABLE,
            Item=item,
            ConditionExpression='attribute_not_exists(RekognitionId)',
        )
    except Exception as e:
        # If exists, Dynamo throws ConditionalCheckFailedException
        msg = str(e)
        if 'ConditionalCheckFailed' in msg:
            return _response(409, {'error': 'UserAlreadyExists'})
        logger.exception('DynamoDB put_item failed (admin-create-teacher)')
        return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})

    _audit_log(admin_email, 'admin', 'admin-create-teacher', {'teacherEmail': email})

    now = int(time.time())
    _upsert_student_notification(
        email,
        f'NOTIF#pwdsetup#{email}'.lower(),
        'Cambia tu contraseña',
        'Tu cuenta de docente ya está creada. Entra con la contraseña temporal y cámbiala antes de continuar.',
        'warning',
        now,
        extra={'Action': 'change-password'},
    )
    email_sent = _send_text_email(
        email,
        'Tu cuenta de docente ya está creada',
        (
            f'Hola {full_name},\n\n'
            'Tu cuenta de docente en Toma Asistencia UMB ya fue creada.\n'
            'Entra con la contraseña temporal que te entregó el administrador y cámbiala al iniciar sesión.\n'
            'Este correo no incluye la contraseña.\n'
        ),
    )

    return _response(200, {
        'ok': True,
        'email': email,
        'fullName': full_name,
        'teacherCode': teacher_code or None,
        'role': 'teacher',
        'mustChangePassword': True,
        'emailSent': email_sent,
    })

def handle_admin_create_student(event, body, image_bytes_fixed, img=None, width=None, height=None):
    """El admin crea la cuenta del estudiante y le toma la foto biométrica en persona."""
    payload = _verify_token(_get_bearer_token(event))
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    admin_email = str(payload.get('sub') or '').strip().lower()

    full_name = _display_person_name(body.get('fullName') or '')
    email = (body.get('email') or '').strip().lower()
    password = (body.get('password') or '').strip()
    student_code = (body.get('studentCode') or '').strip()

    if not full_name or not email or not password:
        return _response(400, {'error': 'MissingFields', 'message': 'Faltan nombre, correo o contraseña.'})
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        return _response(400, {'error': 'InvalidEmail', 'message': 'El correo no es válido.'})
    issue = _password_issue(password)
    if issue:
        return _response(400, {'error': issue[0], 'message': issue[1]})
    if student_code and not 8 <= len(student_code) <= 10:
        return _response(400, {'error': 'InvalidStudentCode', 'message': 'El código estudiantil debe tener entre 8 y 10 caracteres.'})
    if not body.get('consentBiometric'):
        return _response(400, {
            'error': 'BiometricConsentNotAccepted',
            'message': 'Confirma que el estudiante autorizó el tratamiento de sus datos biométricos.',
        })

    try:
        existing = _scan_find_student_by_email(email) or (dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f'USER#{email}'}},
        ) or {}).get('Item')
    except Exception:
        logger.exception('DynamoDB get_item failed (admin-create-student email check)')
        return _response(500, {'error': 'DynamoDBGetFailed'})
    if existing:
        return _response(409, {'error': 'EmailAlreadyRegistered', 'message': 'Ese correo ya tiene una cuenta.'})

    if student_code:
        dup = _ddb_scan(
            first_only=True,
            FilterExpression='#SC = :sc AND #R = :r',
            ExpressionAttributeNames={'#SC': 'StudentCode', '#R': 'Role'},
            ExpressionAttributeValues={':sc': {'S': student_code}, ':r': {'S': 'student'}},
        )
        if (dup or {}).get('Items'):
            return _response(409, {
                'error': 'StudentCodeAlreadyRegistered',
                'message': f'El código estudiantil {student_code} ya está registrado.',
            })

    try:
        face_details = rekognition.detect_faces(Image={'Bytes': image_bytes_fixed}, Attributes=['ALL']).get('FaceDetails') or []
    except Exception:
        logger.exception('detect_faces failed (admin-create-student)')
        return _response(400, {'error': 'FaceDetectFailed', 'message': 'No se pudo analizar la foto. Intenta de nuevo.'})
    photo_issues = _register_photo_issues(face_details)
    if photo_issues:
        return _response(400, {'error': 'InvalidFacePhoto', 'message': photo_issues[0], 'issues': photo_issues})
    if _face_already_registered(image_bytes_fixed):
        return _response(409, {'error': 'FaceAlreadyRegistered', 'message': FACE_ALREADY_REGISTERED_MESSAGE})

    try:
        records = rekognition.index_faces(
            CollectionId=COLLECTION,
            Image={'Bytes': image_bytes_fixed},
            MaxFaces=1,
            QualityFilter='AUTO',
            DetectionAttributes=['DEFAULT'],
        ).get('FaceRecords') or []
    except Exception:
        logger.exception('index_faces failed (admin-create-student)')
        return _response(500, {'error': 'IndexFacesFailed'})
    if not records:
        return _response(400, {'error': 'FaceNotIndexed', 'message': 'No se pudo registrar el rostro. Toma otra foto.'})

    face_id = records[0]['Face']['FaceId']
    now = int(time.time())
    salt_hex = _new_salt_hex()
    item = {
        'RekognitionId': {'S': face_id},
        'FullName': {'S': full_name},
        'Email': {'S': email},
        'Role': {'S': 'student'},
        'PasswordSalt': {'S': salt_hex},
        'PasswordHash': {'S': _hash_password(password, salt_hex)},
        'MustChangePassword': {'BOOL': True},
        # Términos y privacidad los acepta el estudiante al entrar; la biometría la autorizó ante el admin.
        'AcceptTerms': {'BOOL': False},
        'AcceptPrivacy': {'BOOL': False},
        'ConsentBiometric': {'BOOL': True},
        'BiometricConsent': {'BOOL': True},
        'BiometricConsentUpdatedAt': {'N': str(now)},
        'CreatedBy': {'S': admin_email},
    }
    if student_code:
        item['StudentCode'] = {'S': student_code}

    try:
        dynamodb.put_item(TableName=DDB_TABLE, Item=item, ConditionExpression='attribute_not_exists(RekognitionId)')
    except Exception:
        logger.exception('DynamoDB put_item failed (admin-create-student)')
        _delete_faces_from_collection([face_id])
        return _response(500, {'error': 'DynamoDBPutFailed'})

    _audit_log(admin_email, 'admin', 'admin-create-student', {'studentEmail': email})
    _upsert_student_notification(
        email,
        f'NOTIF#pwdsetup#{email}'.lower(),
        'Cambia tu contraseña',
        'Tu cuenta de estudiante ya está creada. Entra con la contraseña temporal y cámbiala antes de continuar.',
        'warning',
        now,
        extra={'Action': 'change-password'},
    )

    return _response(200, {
        'ok': True,
        'email': email,
        'fullName': full_name,
        'studentCode': student_code or None,
        'role': 'student',
        'mustChangePassword': True,
    })

import unicodedata


def _fold_label(raw):
    text = ' '.join(str(raw or '').split())
    if not text:
        return ''
    nfd = unicodedata.normalize('NFD', text.casefold())
    return ''.join(ch for ch in nfd if unicodedata.category(ch) != 'Mn')


def _pretty_label(raw, empty='Sin dato'):
    text = ' '.join(str(raw or '').split())
    if not text:
        return empty
    small = {'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'en', 'a', 'al', 'para', 'por'}
    words = text.casefold().split(' ')
    out = []
    for i, word in enumerate(words):
        if i > 0 and word in small:
            out.append(word)
        else:
            out.append(word[:1].upper() + word[1:] if word else word)
    return ' '.join(out)


def _count_by(values):
    acc = {}
    for raw in values:
        text = ' '.join(str(raw or '').split())
        key = _fold_label(text) or 'sin-dato'
        label = _pretty_label(text)
        if key not in acc:
            acc[key] = {'label': label, 'count': 0}
        acc[key]['count'] += 1
    return [
        {'label': row['label'], 'count': row['count']}
        for _, row in sorted(acc.items(), key=lambda x: (-x[1]['count'], x[1]['label'].lower()))
    ]


def _co_ymd_from_epoch(raw):
    try:
        n = int(raw)
        if n > 10_000_000_000:
            n = n // 1000
        return time.strftime('%Y-%m-%d', time.gmtime(n + CO_TZ_OFFSET_SECONDS))
    except Exception:
        return ''


def _shift_ymd(ymd, days):
    try:
        dt = datetime.datetime.strptime(str(ymd), '%Y-%m-%d')
        return (dt + datetime.timedelta(days=int(days))).strftime('%Y-%m-%d')
    except Exception:
        return ''


def _safe_scan(filter_expression, names, values):
    try:
        return _ddb_scan_all(filter_expression, names, values) or []
    except Exception:
        logger.exception('DynamoDB scan failed (admin dashboard)')
        return []


def handle_admin_dashboard_stats(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    today = _co_today_yyyy_mm_dd()
    week_start = _shift_ymd(today, -6) or today
    semester_start = _shift_ymd(today, -120) or week_start

    now = int(time.time())
    t_local = time.gmtime(now + CO_TZ_OFFSET_SECONDS)
    midnight_utc = int(now) - (t_local.tm_hour * 3600 + t_local.tm_min * 60 + t_local.tm_sec)
    semester_start_utc = midnight_utc - 120 * 24 * 60 * 60

    student_items = _safe_scan(
        '(#R = :r) OR (#T = :t)',
        {'#R': 'Role', '#T': 'Type'},
        {':r': {'S': 'student'}, ':t': {'S': 'Student'}},
    )
    teacher_items = _safe_scan(
        '(#R = :r) OR (#T = :t)',
        {'#R': 'Role', '#T': 'Type'},
        {':r': {'S': 'teacher'}, ':t': {'S': 'Teacher'}},
    )
    class_items = _safe_scan(
        '#T = :t',
        {'#T': 'Type'},
        {':t': {'S': 'Class'}},
    )
    attendance_items = _safe_scan(
        '#T = :t AND #MA >= :s',
        {'#T': 'Type', '#MA': 'MarkedAt'},
        {':t': {'S': 'Attendance'}, ':s': {'N': str(int(semester_start_utc))}},
    )
    session_items = _safe_scan(
        '#T = :t AND #SD >= :sd',
        {'#T': 'Type', '#SD': 'SessionDate'},
        {':t': {'S': 'AttendanceSession'}, ':sd': {'S': semester_start}},
    )
    justification_items = _safe_scan('#T = :t', {'#T': 'Type'}, {':t': {'S': 'Justification'}})

    class_meta = {}
    classes_by_teacher = {}
    for c in class_items:
        cid = (_ddb_s(c, 'ClassId') or '').strip()
        te = (_ddb_s(c, 'TeacherEmail') or '').strip().lower()
        meta = {
            'classId': cid or None,
            'className': _ddb_s(c, 'ClassName') or None,
            'group': _ddb_s(c, 'Group') or None,
            'subjectCode': _ddb_s(c, 'SubjectCode') or None,
            'period': _ddb_s(c, 'Period') or None,
            'teacherEmail': te or None,
        }
        if cid:
            class_meta[cid] = meta
        if te:
            classes_by_teacher.setdefault(te, []).append(meta)

    students = []
    student_by_email = {}
    for it in student_items:
        email = (_ddb_s(it, 'Email') or '').strip().lower()
        flags = _student_consent_summary(it)
        row = {
            'email': email or None,
            'fullName': _ddb_s(it, 'FullName') or None,
            'studentCode': _ddb_s(it, 'StudentCode') or None,
            'program': _first_s(it, 'Program', 'Carrera', 'Career') or None,
            'semester': _first_s(it, 'Semester', 'Semestre') or None,
            'phone': _first_s(it, 'Phone', 'Telefono', 'Tel') or None,
            'hasFace': flags['hasFace'],
            'biometricConsent': flags['biometricConsent'],
            'acceptTerms': flags['acceptTerms'],
            'acceptPrivacy': flags['acceptPrivacy'],
        }
        students.append(row)
        if email:
            student_by_email[email] = row
    students = sorted(students, key=lambda x: str(x.get('fullName') or x.get('email') or ''))

    teachers = []
    seen_teacher = set()
    for tu in teacher_items:
        te = (_ddb_s(tu, 'Email') or '').strip().lower()
        pk = (_ddb_s(tu, 'RekognitionId') or '').strip()
        if not te and pk.upper().startswith('USER#'):
            te = pk.split('#', 1)[-1].strip().lower()
        role = (_ddb_s(tu, 'Role') or '').strip().lower()
        if role and role != 'teacher':
            continue
        if not te:
            continue
        if te in seen_teacher:
            continue
        seen_teacher.add(te)
        owned = classes_by_teacher.get(te, [])
        periods = sorted({str(c.get('period') or '').strip() for c in owned if str(c.get('period') or '').strip()})
        teachers.append({
            'email': te or None,
            'fullName': _ddb_s(tu, 'FullName') or None,
            'teacherCode': _ddb_s(tu, 'TeacherCode') or None,
            'subjectsCount': len(owned),
            'periods': periods,
            'classes': owned,
            'acceptTerms': _ddb_bool(tu, 'AcceptTerms'),
            'acceptPrivacy': _ddb_bool(tu, 'AcceptPrivacy'),
        })
    teachers = sorted(teachers, key=lambda x: str(x.get('fullName') or x.get('email') or ''))

    with_face = sum(1 for s in students if s.get('hasFace'))
    with_classes = sum(1 for t in teachers if int(t.get('subjectsCount') or 0) > 0)

    session_by_id = {}
    for it in session_items:
        sid = (_ddb_s(it, 'SessionId') or '').strip()
        if not sid:
            continue
        corte_s = (_ddb_s(it, 'Corte') or '').strip()
        if corte_s not in ('1', '2'):
            corte_s = '1'
        session_by_id[sid] = corte_s

    last7 = []
    for i in range(6, -1, -1):
        d = _shift_ymd(today, -i)
        last7.append({
            'date': d,
            'asistencia': 0,
            'retardo': 0,
            'inasistencia': 0,
            'total': 0,
            'sessions': 0,
        })
    by_date = {row['date']: row for row in last7 if row.get('date')}

    recent = []
    status_today = {'asistencia': 0, 'retardo': 0, 'inasistencia': 0}
    for it in attendance_items:
        marked_at = _ddb_n(it, 'MarkedAt')
        ymd = _co_ymd_from_epoch(marked_at)
        status = _normalize_attendance_status(_ddb_s(it, 'Status'))
        cid = (_ddb_s(it, 'ClassId') or '').strip()
        email = (_ddb_s(it, 'StudentEmail') or '').strip().lower()
        sid = (_ddb_s(it, 'SessionId') or '').strip()
        stu = student_by_email.get(email) or {}
        cls = class_meta.get(cid) or {}
        row = {
            'studentEmail': email or None,
            'studentName': _ddb_s(it, 'StudentName') or stu.get('fullName'),
            'studentCode': _ddb_s(it, 'StudentCode') or stu.get('studentCode'),
            'status': status,
            'classId': cid or None,
            'className': cls.get('className'),
            'group': cls.get('group'),
            'teacherEmail': (_ddb_s(it, 'TeacherEmail') or cls.get('teacherEmail') or '').strip().lower() or None,
            'program': stu.get('program'),
            'semester': stu.get('semester'),
            'date': ymd or None,
            'markedAt': int(marked_at) if str(marked_at).isdigit() else None,
            'sessionId': sid or None,
            'corte': session_by_id.get(sid) or '1',
            'presentInPhoto': _ddb_bool(it, 'PresentInPhoto'),
        }
        recent.append(row)
        bucket = by_date.get(ymd)
        if bucket and status in bucket:
            bucket[status] += 1
            bucket['total'] += 1
        if ymd == today and status in status_today:
            status_today[status] += 1

    recent = sorted(recent, key=lambda x: int(x.get('markedAt') or 0), reverse=True)
    today_list = [r for r in recent if r.get('date') == today]

    for it in session_items:
        ymd = _ddb_s(it, 'SessionDate')
        bucket = by_date.get(ymd)
        if bucket:
            bucket['sessions'] += 1

    def _as_int(value):
        try:
            return int(float(value or 0))
        except Exception:
            return 0

    week_dates = {row['date'] for row in last7 if row.get('date')}
    sessions_today_list = []
    photo = {
        'sessionsWithPhoto': 0,
        'sessionsWithoutPhoto': 0,
        'facesDetected': 0,
        'recognized': 0,
        'unrecognized': 0,
    }
    for it in session_items:
        ymd = _ddb_s(it, 'SessionDate')
        cid = (_ddb_s(it, 'ClassId') or '').strip()
        cls = class_meta.get(cid) or {}
        has_photo = bool(_ddb_n(it, 'PhotoConfirmedAt'))
        faces = _as_int(_ddb_n(it, 'PhotoFacesDetected'))
        recognized = _as_int(_ddb_n(it, 'PhotoRecognizedCount'))
        unmatched = _as_int(_ddb_n(it, 'PhotoUnmatchedCount'))
        if not unmatched and faces:
            unmatched = max(0, faces - recognized)
        if ymd in week_dates:
            if has_photo:
                photo['sessionsWithPhoto'] += 1
                photo['facesDetected'] += faces
                photo['recognized'] += recognized
                photo['unrecognized'] += unmatched
            else:
                photo['sessionsWithoutPhoto'] += 1
        if ymd != today:
            continue
        sessions_today_list.append({
            'sessionId': _ddb_s(it, 'SessionId') or None,
            'classId': cid or None,
            'className': cls.get('className'),
            'group': cls.get('group'),
            'teacherEmail': (_ddb_s(it, 'TeacherEmail') or cls.get('teacherEmail') or '').strip().lower() or None,
            'sessionDate': ymd or None,
            'hasPhoto': has_photo,
            'facesDetected': faces,
            'recognized': recognized,
            'unrecognized': unmatched,
        })
    sessions_today_list = sorted(sessions_today_list, key=lambda x: str(x.get('className') or ''))
    if not photo['recognized']:
        photo['recognized'] = sum(1 for r in today_list if r.get('presentInPhoto') is True)
        photo['unrecognized'] = max(
            photo['unrecognized'],
            sum(1 for r in today_list if r.get('presentInPhoto') is False),
        )

    attendance_today = int(status_today['asistencia'] + status_today['retardo'] + status_today['inasistencia'])
    sessions_today = len(sessions_today_list)

    justif_pending = 0
    for it in justification_items:
        deadline = _as_int(_ddb_n(it, 'DeadlineEpoch'))
        if (_ddb_s(it, 'Status') or 'enviada') == 'enviada' and not (deadline and now > deadline):
            justif_pending += 1

    consents_students = sum(
        1 for s in students
        if not (s.get('acceptTerms') and s.get('acceptPrivacy') and (s.get('biometricConsent') or s.get('hasFace')))
    )
    consents_teachers = sum(1 for t in teachers if not (t.get('acceptTerms') is True and t.get('acceptPrivacy') is True))

    return _response(200, {
        'ok': True,
        'date': today,
        'students': {
            'total': len(students),
            'withFace': with_face,
            'withoutFace': max(0, len(students) - with_face),
            'byProgram': _count_by(s.get('program') for s in students),
            'bySemester': _count_by(s.get('semester') for s in students),
            'list': students,
        },
        'teachers': {
            'total': len(teachers),
            'withClasses': with_classes,
            'withoutClasses': max(0, len(teachers) - with_classes),
            'classesTotal': len(class_items),
            'byPeriod': _count_by(
                p
                for t in teachers
                for p in (t.get('periods') or [])
            ),
            'list': teachers,
        },
        'attendance': {
            'markedToday': attendance_today,
            'presentToday': status_today['asistencia'],
            'lateToday': status_today['retardo'],
            'absentToday': status_today['inasistencia'],
            'byStatusToday': [
                {'label': 'Asistencia', 'status': 'asistencia', 'count': status_today['asistencia']},
                {'label': 'Retardo', 'status': 'retardo', 'count': status_today['retardo']},
                {'label': 'Inasistencia', 'status': 'inasistencia', 'count': status_today['inasistencia']},
            ],
            'last7Days': last7,
            'byProgramToday': _count_by(r.get('program') for r in today_list),
            'byClassToday': _count_by(r.get('className') for r in today_list),
            'todayList': today_list[:200],
            'recentList': recent[:400],
        },
        'sessions': {
            'today': sessions_today,
            'last7Days': [{'date': row['date'], 'count': row['sessions']} for row in last7],
            'todayList': sessions_today_list,
            'photo': photo,
        },
        'reports': {'total': sessions_today},
        'classes': {'total': len(class_items)},
        'justifications': {'total': len(justification_items), 'pending': justif_pending},
        'consents': {
            'studentsPending': consents_students,
            'teachersPending': consents_teachers,
            'pending': consents_students + consents_teachers,
        },
    })


_CONSENT_KEYS = ('terms', 'privacy', 'biometric')


def _profile_missing(item: dict, role: str, consents_only: bool = False) -> list:
    """Datos y consentimientos que le faltan a un usuario, como [(clave, etiqueta)]."""
    flags = _student_consent_summary(item)
    missing = []
    if not consents_only and not (_ddb_s(item, 'FullName') or '').strip():
        missing.append(('name', 'nombre completo'))
    if role == 'student' and not consents_only:
        if not _first_s(item, 'Program', 'Carrera', 'Career'):
            missing.append(('program', 'carrera'))
        if not _first_s(item, 'Semester', 'Semestre'):
            missing.append(('semester', 'semestre'))
        if not _first_s(item, 'Phone', 'Telefono', 'Tel'):
            missing.append(('phone', 'teléfono'))
    if _ddb_bool(item, 'AcceptTerms') is not True:
        missing.append(('terms', 'términos y condiciones'))
    if _ddb_bool(item, 'AcceptPrivacy') is not True:
        missing.append(('privacy', 'política de privacidad'))
    if role == 'student' and not flags.get('biometricConsent') and not flags.get('hasFace'):
        missing.append(('biometric', 'consentimiento biométrico'))
    return missing


def _send_profile_request(email: str, role: str, missing: list, now: int) -> dict:
    """Notificación que lleva al usuario a completar lo que falta."""
    keys = [k for k, _ in missing]
    if any(k in ('name', 'program', 'semester', 'phone') for k in keys):
        open_to = 'edit'
    elif 'biometric' in keys:
        open_to = 'biometric'
    elif 'terms' in keys:
        open_to = 'terms'
    else:
        open_to = 'privacy'

    labels = [label for _, label in missing]
    if len(labels) == 1:
        message = f'Administración te pide completar: {labels[0]}.'
    else:
        message = f'Administración te pide completar: {", ".join(labels[:-1])} y {labels[-1]}.'

    notif = _upsert_student_notification(
        email,
        f'NOTIF#adminreq#{email}'.lower(),
        'Completa tus datos',
        message,
        'warning',
        now,
        extra={
            'Action': 'admin_request',
            'Open': open_to,
            'Missing': ','.join(keys),
            'Role': role,
        },
        keep_created=False,
    )
    return {'missing': keys, 'open': open_to, 'notification': notif}


def _consent_users(role: str) -> list:
    """[(rol, item)] de estudiantes y/o docentes."""
    out = []
    if role in ('student', 'all'):
        for it in _ddb_scan_all('#R = :r', {'#R': 'Role'}, {':r': {'S': 'student'}}):
            out.append(('student', it))
    if role in ('teacher', 'all'):
        for it in _ddb_scan_all('#R = :r', {'#R': 'Role'}, {':r': {'S': 'teacher'}}):
            out.append(('teacher', it))
    return out


def handle_admin_request_profile(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    admin_email = str(payload.get('sub') or '').strip().lower()
    email = str((body or {}).get('email') or (body or {}).get('correo') or '').strip().lower()
    role = str((body or {}).get('role') or 'student').strip().lower()
    if role not in ('student', 'teacher'):
        role = 'student'
    consents_only = bool((body or {}).get('consentsOnly'))
    if not email:
        return _response(400, {'error': 'Missing field: email'})

    if role == 'teacher':
        item = _scan_find_user_by_email(email, roles=['teacher'], types=['Teacher'])
    else:
        item = _scan_find_student_by_email(email)
    if not item:
        return _response(404, {'error': 'UserNotFound'})

    missing = _profile_missing(item, role, consents_only=consents_only)
    if not missing:
        return _response(400, {'error': 'NothingToRequest'})

    sent = _send_profile_request(email, role, missing, int(time.time()))
    _audit_log(admin_email, 'admin', 'admin-request-profile', {
        'userEmail': email,
        'role': role,
        'missing': sent['missing'],
        'open': sent['open'],
    })
    return _response(200, {'ok': True, 'email': email, **sent})


def _handle_request_all_consents(admin_email: str, body) -> dict:
    """Pide los consentimientos pendientes a todos los usuarios del rol indicado."""
    role = str((body or {}).get('role') or 'all').strip().lower()
    if role not in ('student', 'teacher', 'all'):
        role = 'all'
    now = int(time.time())
    sent = {'student': 0, 'teacher': 0}
    for user_role, item in _consent_users(role):
        email = (_ddb_s(item, 'Email') or '').strip().lower()
        if not email:
            continue
        missing = _profile_missing(item, user_role, consents_only=True)
        if not missing:
            continue
        _send_profile_request(email, user_role, missing, now)
        sent[user_role] += 1
    _audit_log(admin_email, 'admin', 'admin-request-all-consents', {'role': role, **sent})
    return _response(200, {
        'ok': True,
        'role': role,
        'studentsNotified': sent['student'],
        'teachersNotified': sent['teacher'],
        'total': sent['student'] + sent['teacher'],
    })
