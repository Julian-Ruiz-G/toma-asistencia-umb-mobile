from runtime import *  # noqa: F401,F403

def handle_admin_students(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    try:
        scan_resp = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='(#R = :r) OR (#T = :t)',
            ExpressionAttributeNames={'#R': 'Role', '#T': 'Type'},
            ExpressionAttributeValues={':r': {'S': 'student'}, ':t': {'S': 'Student'}},
            Limit=1000,
        )
    except Exception as e:
        logger.exception('DynamoDB scan failed (admin-students)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    items = (scan_resp or {}).get('Items') or []
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
        enroll_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t',
            ExpressionAttributeNames={'#T': 'Type'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}},
            Limit=2000,
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

def handle_admin_update_student(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    admin_email = str(payload.get('sub') or '').strip().lower()

    email = (body.get('email') or body.get('correo') or '').strip().lower()
    full_name = (body.get('fullName') or body.get('nombre') or body.get('nombreCompleto') or '').strip()
    student_code = (body.get('studentCode') or body.get('codigoEstudiante') or '').strip()

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

    _audit_log(admin_email, 'admin', 'admin-update-student', {'studentEmail': email})
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
        users_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='(#R = :r) OR (#T = :t)',
            ExpressionAttributeNames={'#R': 'Role', '#T': 'Type'},
            ExpressionAttributeValues={':r': {'S': 'teacher'}, ':t': {'S': 'Teacher'}},
            Limit=1000,
        )
        teacher_users = (users_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (admin-teachers users)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    try:
        class_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t',
            ExpressionAttributeNames={'#T': 'Type'},
            ExpressionAttributeValues={':t': {'S': 'Class'}},
            Limit=2000,
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
    for tu in teacher_users:
        te = (_ddb_s(tu, 'Email') or '').strip().lower()
        out.append({
            'email': te or None,
            'fullName': _ddb_s(tu, 'FullName') or None,
            'teacherCode': _ddb_s(tu, 'TeacherCode') or None,
            'classes': classes_by_teacher.get(te, []),
            'subjectsCount': len(classes_by_teacher.get(te, [])),
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
        salt_hex = _new_salt_hex()
        pw_hash = _hash_password(new_password, salt_hex)
        updates.append('#PS = :ps')
        updates.append('#PH = :ph')
        names['#PS'] = 'PasswordSalt'
        names['#PH'] = 'PasswordHash'
        vals[':ps'] = {'S': salt_hex}
        vals[':ph'] = {'S': pw_hash}

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

    _audit_log(admin_email, 'admin', 'admin-update-teacher', {'teacherEmail': email})
    return _response(200, {'ok': True})

def handle_admin_delete_teacher(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    admin_email = str(payload.get('sub') or '').strip().lower()

    email = (body.get('email') or body.get('correo') or '').strip().lower()
    if not email:
        return _response(400, {'error': 'Missing field: email'})

    item = _scan_find_user_by_email(email, roles=['teacher'], types=['Teacher'])
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
        scan_resp = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t',
            ExpressionAttributeNames={'#T': 'Type'},
            ExpressionAttributeValues={':t': {'S': 'AuditLog'}},
            Limit=limit,
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

    logs = sorted(logs, key=lambda x: int(x.get('createdAt') or 0), reverse=True)
    return _response(200, {'ok': True, 'logs': logs})

def handle_admin_consents(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    try:
        scan_resp = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#R = :r',
            ExpressionAttributeNames={'#R': 'Role'},
            ExpressionAttributeValues={':r': {'S': 'student'}},
            Limit=1000,
        )
    except Exception as e:
        logger.exception('DynamoDB scan failed (admin-consents)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    items = (scan_resp or {}).get('Items') or []
    rows = []
    for it in items:
        email = _ddb_s(it, 'Email') or None
        full_name = _ddb_s(it, 'FullName') or None
        student_code = _ddb_s(it, 'StudentCode') or None
        flags = _student_consent_summary(it)
        if flags['biometricConsent']:
            status = 'approved'
        elif flags['hasFace']:
            status = 'approved'
        else:
            status = 'pending'

        rows.append({
            'email': email,
            'fullName': full_name,
            'studentCode': student_code,
            'type': 'biometric',
            'status': status,
            'acceptTerms': flags['acceptTerms'],
            'acceptPrivacy': flags['acceptPrivacy'],
            'biometricConsent': flags['biometricConsent'],
            'hasFace': flags['hasFace'],
            'updatedAt': flags['updatedAt'],
        })

    rows = sorted(rows, key=lambda x: str(x.get('email') or ''))
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

    return _response(200, {
        'ok': True,
        'email': email,
        'fullName': full_name,
        'teacherCode': teacher_code or None,
        'role': 'teacher',
    })

def handle_admin_dashboard_stats(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'admin':
        return _response(401, {'error': 'Unauthorized'})

    today = _co_today_yyyy_mm_dd()

    # Students count
    students_count = 0
    try:
        resp = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='(#R = :r) OR (#T = :t)',
            ExpressionAttributeNames={'#R': 'Role', '#T': 'Type'},
            ExpressionAttributeValues={':r': {'S': 'student'}, ':t': {'S': 'Student'}},
            Select='COUNT',
        )
        students_count = int((resp or {}).get('Count') or 0)
    except Exception:
        students_count = 0

    # Teachers count
    teachers_count = 0
    try:
        resp = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='(#R = :r) OR (#T = :t)',
            ExpressionAttributeNames={'#R': 'Role', '#T': 'Type'},
            ExpressionAttributeValues={':r': {'S': 'teacher'}, ':t': {'S': 'Teacher'}},
            Select='COUNT',
        )
        teachers_count = int((resp or {}).get('Count') or 0)
    except Exception:
        teachers_count = 0

    # Attendance marked today: scan Attendance and count those whose MarkedAt falls in today's CO window
    attendance_today = 0
    try:
        # Colombia day boundaries expressed as UTC epoch
        now = int(time.time())
        t_local = time.gmtime(now + CO_TZ_OFFSET_SECONDS)
        midnight_utc = int(now) - (t_local.tm_hour * 3600 + t_local.tm_min * 60 + t_local.tm_sec)
        start_utc = midnight_utc
        end_utc = midnight_utc + 24 * 60 * 60

        scan_resp = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #MA BETWEEN :s AND :e',
            ExpressionAttributeNames={'#T': 'Type', '#MA': 'MarkedAt'},
            ExpressionAttributeValues={
                ':t': {'S': 'Attendance'},
                ':s': {'N': str(int(start_utc))},
                ':e': {'N': str(int(end_utc))},
            },
            Select='COUNT',
        )
        attendance_today = int((scan_resp or {}).get('Count') or 0)
    except Exception:
        attendance_today = 0

    # Sessions created today
    sessions_today = 0
    if today:
        try:
            scan_resp = dynamodb.scan(
                TableName=DDB_TABLE,
                FilterExpression='#T = :t AND #SD = :sd',
                ExpressionAttributeNames={'#T': 'Type', '#SD': 'SessionDate'},
                ExpressionAttributeValues={':t': {'S': 'AttendanceSession'}, ':sd': {'S': today}},
                Select='COUNT',
            )
            sessions_today = int((scan_resp or {}).get('Count') or 0)
        except Exception:
            sessions_today = 0

    return _response(200, {
        'ok': True,
        'date': today,
        'students': {'total': students_count},
        'teachers': {'total': teachers_count},
        'attendance': {'markedToday': attendance_today},
        # No existe entidad "Report" en Dynamo actualmente; usamos sesiones del día como proxy.
        'reports': {'total': sessions_today},
    })

