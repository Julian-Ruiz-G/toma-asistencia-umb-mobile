from runtime import *  # noqa: F401,F403

def handle_create_attendance_qr(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    teacher_email = str(payload.get('sub') or '').strip().lower()
    class_id = (body.get('classId') or '').strip()
    corte = (body.get('corte') or '').strip()
    if not class_id:
        return _response(400, {'error': 'Missing field: classId'})

    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (create-attendance-qr)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    owner = _ddb_s(class_item, 'TeacherEmail').strip().lower()
    if owner and owner != teacher_email:
        return _response(403, {'error': 'Forbidden'})

    now = int(time.time())
    ok_sched, sched_err, sched_payload, scheduled_start = _attendance_qr_schedule_gate(class_item, now)
    if not ok_sched:
        code = 400
        body_out = {'error': sched_err, **(sched_payload or {})}
        return _response(code, body_out)
    if scheduled_start is None:
        return _response(400, {'error': 'InvalidStartTime'})

    session_date = time.strftime('%Y-%m-%d', time.gmtime(now + CO_TZ_OFFSET_SECONDS))

    # Buscar si ya existe una sesión hoy para esta clase
    existing_session = None

    try:
        scan_resp = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #CID = :cid AND #SD = :sd',
            ExpressionAttributeNames={
                '#T': 'Type',
                '#CID': 'ClassId',
                '#SD': 'SessionDate'
            },
            ExpressionAttributeValues={
                ':t': {'S': 'AttendanceSession'},
                ':cid': {'S': class_id},
                ':sd': {'S': session_date}
            },
            Limit=1,
        )

        items = (scan_resp or {}).get('Items') or []

        if items:
            existing_session = items[0]

    except Exception as e:
        logger.exception('DynamoDB scan failed (search existing attendance session)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    # Si ya existe sesión hoy, reutilizarla
    if existing_session:
        session_id = _ddb_s(existing_session, 'SessionId')

        scheduled_start = int(
            (existing_session.get('ScheduledStartEpoch') or {}).get('N') or 0
        )

    else:
        # Crear nueva sesión
        session_id = f"{class_id}_{session_date}"
        session_pk = f"ATTSESSION#{session_id}"

        session_item = {
            'RekognitionId': {'S': session_pk},
            'Type': {'S': 'AttendanceSession'},
            'SessionId': {'S': session_id},
            'ClassId': {'S': class_id},
            'TeacherEmail': {'S': teacher_email},
            'SessionDate': {'S': session_date},
            'ScheduledStartEpoch': {'N': str(int(scheduled_start))},
            'LateAfterSeconds': {'N': str(15 * 60)},
            'CreatedAt': {'N': str(now)},
        }

        if corte:
            session_item['Corte'] = {'S': corte}

        try:
            dynamodb.put_item(
                TableName=DDB_TABLE,
                Item=session_item
            )
        except Exception as e:
            logger.exception('DynamoDB put_item failed (create-attendance-qr)')
            return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})
    attendance_token = None
    try:
        attendance_token = _sign_token({
            'role': 'attendance',
            'classId': class_id,
            'sessionId': session_id,
            'teacherEmail': teacher_email,
            'iat': now,
            'exp': now + 60 * 60 * 4,
        })
    except Exception:
        attendance_token = None

    return _response(200, {
        'ok': True,
        'classId': class_id,
        'sessionId': session_id,
        'sessionDate': session_date,
        'scheduledStartEpoch': int(scheduled_start),
        'lateAfterSeconds': 15 * 60,
        'attendanceToken': attendance_token,
        'corte': corte,
    })

def handle_mark_attendance(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'student':
        return _response(401, {'error': 'Unauthorized'})

    attendance_token = (body.get('attendanceToken') or body.get('qr') or '').strip()
    if not attendance_token:
        logger.error(f'Mark attendance: Missing attendanceToken. Body keys: {list(body.keys()) if body else "empty"}')
        return _response(400, {'error': 'Missing field: attendanceToken'})

    logger.info(f'Mark attendance: Verifying token: {attendance_token[:20]}...')
    att_payload = _verify_token(attendance_token)
    if not att_payload:
        logger.error(f'Mark attendance: Token verification failed for token: {attendance_token[:20]}...')
        return _response(400, {'error': 'InvalidAttendanceToken', 'details': 'Token verification failed'})

    if att_payload.get('role') != 'attendance':
        logger.error(f'Mark attendance: Invalid token role. Expected: attendance, Got: {att_payload.get("role")}')
        return _response(400, {'error': 'InvalidAttendanceToken', 'details': f'Invalid role: {att_payload.get("role")}'})

    class_id = str(att_payload.get('classId') or '').strip()
    session_id = str(att_payload.get('sessionId') or '').strip()
    teacher_email = str(att_payload.get('teacherEmail') or '').strip().lower()
    if not class_id or not session_id or not teacher_email:
        return _response(400, {'error': 'InvalidAttendanceToken'})

    student_email = str(payload.get('sub') or '').strip().lower()
    if not student_email:
        return _response(401, {'error': 'Unauthorized'})

    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (mark-attendance class)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    owner = _ddb_s(class_item, 'TeacherEmail').strip().lower()
    if owner and owner != teacher_email:
        return _response(403, {'error': 'Forbidden'})

    try:
        enroll_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #CID = :cid',
            ExpressionAttributeNames={'#T': 'Type', '#CID': 'ClassId'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':cid': {'S': class_id}},
            Limit=300,
        )
        enroll_items = (enroll_scan or {}).get('Items') or []
        enrolled = False
        for en in enroll_items:
            se = (_ddb_s(en, 'StudentEmail') or '').strip().lower()
            if se and se == student_email:
                enrolled = True
                break
        if not enrolled:
            return _response(403, {'error': 'NotEnrolled'})
    except Exception:
        return _response(403, {'error': 'NotEnrolled'})

    try:
        session_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"ATTSESSION#{session_id}"}}
        )
        session_item = (session_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (mark-attendance session)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not session_item:
        return _response(404, {'error': 'SessionNotFound'})
    if _ddb_s(session_item, 'ClassId') != class_id:
        return _response(400, {'error': 'SessionClassMismatch'})

    # If the teacher already confirmed the session with a photo, do not allow changes.
    if _ddb_n(session_item, 'PhotoConfirmedAt'):
        return _response(409, {'error': 'AttendanceLocked', 'message': 'La asistencia ya fue confirmada con foto.'})

    scheduled_start = int((_ddb_n(session_item, 'ScheduledStartEpoch') or '0') or '0')
    late_after = int((_ddb_n(session_item, 'LateAfterSeconds') or str(15 * 60)) or str(15 * 60))

    now = int(time.time())
    delta = now - scheduled_start
    status = 'asistencia'
    if delta > late_after:
        status = 'retardo'

    provided_name = (body.get('studentName') or '').strip()
    provided_code = (body.get('studentCode') or '').strip()

    student_name = provided_name or None
    student_code = provided_code or None
    try:
        scan_resp = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#E = :e AND #R = :r',
            ExpressionAttributeNames={'#E': 'Email', '#R': 'Role'},
            ExpressionAttributeValues={':e': {'S': student_email}, ':r': {'S': 'student'}},
            Limit=1,
        )
        items = (scan_resp or {}).get('Items') or []
        if items:
            it = items[0]
            student_name = student_name or (_ddb_s(it, 'FullName') or None)
            student_code = student_code or (_ddb_s(it, 'StudentCode') or None)
    except Exception:
        pass

    att_pk = f"ATTEND#{session_id}#{student_email}".lower()
    att_item = {
        'RekognitionId': {'S': att_pk},
        'Type': {'S': 'Attendance'},
        'SessionId': {'S': session_id},
        'ClassId': {'S': class_id},
        'TeacherEmail': {'S': teacher_email},
        'StudentEmail': {'S': student_email},
        'MarkedAt': {'N': str(now)},
        'Status': {'S': status},
    }
    if student_name:
        att_item['StudentName'] = {'S': student_name}
    if student_code:
        att_item['StudentCode'] = {'S': student_code}

    try:
        dynamodb.put_item(TableName=DDB_TABLE, Item=att_item)
    except Exception as e:
        logger.exception('DynamoDB put_item failed (mark-attendance)')
        return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})

    class_name = _ddb_s(class_item, 'ClassName') if class_item else class_id
    _notify_student_attendance(student_email, session_id, class_id, class_name, status, now, 'qr')

    return _response(200, {
        'ok': True,
        'classId': class_id,
        'sessionId': session_id,
        'studentEmail': student_email,
        'status': status,
        'markedAt': now,
        'time': _clock_colombia(now),
    })

def handle_attendance_details(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    teacher_email = str(payload.get('sub') or '').strip().lower()
    session_id = (body.get('sessionId') or '').strip()
    if not session_id:
        return _response(400, {'error': 'Missing field: sessionId'})

    try:
        session_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"ATTSESSION#{session_id}"}}
        )
        session_item = (session_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (attendance-details session)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not session_item:
        return _response(404, {'error': 'SessionNotFound'})

    class_id = _ddb_s(session_item, 'ClassId')
    if not class_id:
        return _response(500, {'error': 'InvalidSession'})

    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (attendance-details class)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    owner = _ddb_s(class_item, 'TeacherEmail').strip().lower()
    if owner and owner != teacher_email:
        return _response(403, {'error': 'Forbidden'})

    try:
        enroll_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #CID = :cid',
            ExpressionAttributeNames={'#T': 'Type', '#CID': 'ClassId'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':cid': {'S': class_id}},
            Limit=300,
        )
        enroll_items = (enroll_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (attendance-details enrollments)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    roster_emails = []
    roster_by_email = {}
    seen = set()
    for en in enroll_items:
        se = (_ddb_s(en, 'StudentEmail') or '').strip().lower()
        if not se or se in seen:
            continue
        seen.add(se)
        roster_emails.append(se)
        roster_by_email[se] = {
            'studentEmail': se,
            'studentName': _ddb_s(en, 'StudentName') or None,
            'studentCode': _ddb_s(en, 'StudentCode') or None,
        }

    try:
        att_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #SID = :sid',
            ExpressionAttributeNames={'#T': 'Type', '#SID': 'SessionId'},
            ExpressionAttributeValues={':t': {'S': 'Attendance'}, ':sid': {'S': session_id}},
            Limit=500,
        )
        att_items = (att_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (attendance-details attendance)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    att_by_email = {}
    for it in att_items:
        se = (_ddb_s(it, 'StudentEmail') or '').strip().lower()
        if not se:
            continue
        att_by_email[se] = {
            'status': _ddb_s(it, 'Status') or 'asistencia',
            'markedAt': (it.get('MarkedAt', {}) or {}).get('N') or None,
        }

    results = []
    for se in roster_emails:
        base = roster_by_email.get(se) or {'studentEmail': se}
        att = att_by_email.get(se)
        status = 'inasistencia'
        marked_at = None
        if att:
            status = att.get('status') or 'asistencia'
            marked_at = att.get('markedAt')
        results.append({
            'studentEmail': se,
            'studentName': base.get('studentName'),
            'studentCode': base.get('studentCode'),
            'status': status,
            'markedAt': marked_at,
        })

    return _response(200, {
        'ok': True,
        'session': {
            'sessionId': session_id,
            'classId': class_id,
            'sessionDate': _ddb_s(session_item, 'SessionDate') or None,
            'scheduledStartEpoch': _ddb_n(session_item, 'ScheduledStartEpoch') or None,
            'lateAfterSeconds': _ddb_n(session_item, 'LateAfterSeconds') or None,
        },
        'class': {
            'classId': class_id,
            'className': _ddb_s(class_item, 'ClassName'),
            'group': _ddb_s(class_item, 'Group'),
            'startTime': _ddb_s(class_item, 'StartTime'),
            'endTime': _ddb_s(class_item, 'EndTime'),
            'teacherEmail': _ddb_s(class_item, 'TeacherEmail'),
        },
        'results': results,
    })

def handle_set_attendance_status(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    teacher_email = str(payload.get('sub') or '').strip().lower()
    session_id = (body.get('sessionId') or '').strip()
    student_email = str(body.get('studentEmail') or body.get('email') or '').strip().lower()
    status = _normalize_attendance_status(body.get('status') or '')
    if not session_id or not student_email:
        return _response(400, {'error': 'Missing fields: sessionId, studentEmail, status'})
    if status not in ('asistencia', 'retardo', 'inasistencia'):
        return _response(400, {'error': 'Invalid status'})

    try:
        session_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f'ATTSESSION#{session_id}'}},
        )
        session_item = (session_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (set-attendance-status session)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not session_item:
        return _response(404, {'error': 'SessionNotFound'})

    class_id = (_ddb_s(session_item, 'ClassId') or '').strip()
    if not class_id:
        return _response(400, {'error': 'InvalidSessionClassId'})

    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f'CLASS#{class_id}'}},
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (set-attendance-status class)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    owner = (_ddb_s(class_item, 'TeacherEmail') or '').strip().lower()
    if owner and owner != teacher_email:
        return _response(403, {'error': 'Forbidden'})

    now = int(time.time())
    ok_hours, hours_err, hours_payload, _start_ep = _attendance_qr_schedule_gate(class_item, now, 'manual')
    if not ok_hours:
        return _response(403, {'error': hours_err, **(hours_payload or {})})

    enrolled = False
    student_name = None
    student_code = None
    enroll_item = None
    enroll_pks = []
    for pk in (f'ENROLL#{class_id}#{student_email}', f'ENROLL#{class_id}#{student_email}'.lower()):
        if pk not in enroll_pks:
            enroll_pks.append(pk)
    for pk in enroll_pks:
        try:
            en_resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': pk}},
            )
            it = (en_resp or {}).get('Item')
            if it and (_ddb_s(it, 'Type') or '') == 'Enrollment':
                enroll_item = it
                break
        except Exception:
            logger.exception('DynamoDB get_item failed (set-attendance-status enrollment pk)')

    if not enroll_item:
        try:
            enroll_scan = dynamodb.scan(
                TableName=DDB_TABLE,
                FilterExpression='#T = :t AND #CID = :cid',
                ExpressionAttributeNames={'#T': 'Type', '#CID': 'ClassId'},
                ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':cid': {'S': class_id}},
                Limit=300,
            )
            for en in (enroll_scan or {}).get('Items') or []:
                se = (_ddb_s(en, 'StudentEmail') or '').strip().lower()
                if se and se == student_email:
                    enroll_item = en
                    break
        except Exception:
            logger.exception('DynamoDB scan failed (set-attendance-status enrollment)')

    if enroll_item:
        enrolled = True
        student_name = _ddb_s(enroll_item, 'StudentName') or None
        student_code = _ddb_s(enroll_item, 'StudentCode') or None
    if not enrolled:
        return _response(403, {'error': 'NotEnrolled'})

    now = int(time.time())
    att_pk = f'ATTEND#{session_id}#{student_email}'.lower()
    att_item = {
        'RekognitionId': {'S': att_pk},
        'Type': {'S': 'Attendance'},
        'SessionId': {'S': session_id},
        'ClassId': {'S': class_id},
        'TeacherEmail': {'S': teacher_email},
        'StudentEmail': {'S': student_email},
        'MarkedAt': {'N': str(now)},
        'Status': {'S': status},
        'Method': {'S': 'manual'},
    }
    if student_name:
        att_item['StudentName'] = {'S': student_name}
    if student_code:
        att_item['StudentCode'] = {'S': student_code}

    try:
        dynamodb.put_item(TableName=DDB_TABLE, Item=att_item)
    except Exception as e:
        logger.exception('DynamoDB put_item failed (set-attendance-status)')
        return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})

    class_name = _ddb_s(class_item, 'ClassName') or class_id
    _notify_student_attendance(student_email, session_id, class_id, class_name, status, now, 'manual')

    return _response(200, {
        'ok': True,
        'sessionId': session_id,
        'studentEmail': student_email,
        'status': status,
        'markedAt': now,
        'method': 'manual',
    })

def handle_confirm_attendance_photo(event, body):
    logger.info('=== PHOTO CONFIRMATION REQUEST START ===')

    token = _get_bearer_token(event)
    logger.info(f'Photo: Token extracted: {token[:20] if token else "missing"}...')

    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        logger.error(f'Photo: Auth failed - payload: {payload}, role: {payload.get("role") if payload else "none"}')
        return _response(401, {'error': 'Unauthorized'})

    teacher = str(payload.get('sub') or '').strip().lower()
    session_id = (body.get('sessionId') or '').strip()
    image_b64 = body.get('imageBase64') if isinstance(body, dict) else None
    corte_override = (body.get('corte') or '').strip() if isinstance(body, dict) else ''

    logger.info(f'Photo: Request - teacher={teacher}, sessionId={session_id}, has_image={bool(image_b64)}')
    logger.info(f'Photo: Body keys: {list(body.keys()) if body else "empty"}')

    if not session_id:
        logger.error('Photo: Missing sessionId')
        return _response(400, {'error': 'Missing field: sessionId'})
    if not image_b64:
        logger.error('Photo: Missing imageBase64')
        return _response(400, {'error': 'Missing field: imageBase64'})

    try:
        logger.info(
            f"confirm_attendance_photo start teacher={teacher} sessionId={session_id} "
            f"img_b64_len={len(str(image_b64) or '')} pil={PIL_AVAILABLE}"
        )
    except Exception:
        pass

    try:
        session_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"ATTSESSION#{session_id}"}}
        )
        session_item = (session_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (confirm-attendance-photo)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    # Validar que la sesión exista
    if not session_item:
        return _response(404, {'error': 'SessionNotFound'})

    # Validar rango de tiempo para tomar foto
    # Obtener hora programada de la sesión
    scheduled_start_epoch = int(_ddb_n(session_item, 'ScheduledStartEpoch') or 0)
    now = int(time.time())

    logger.info(f'Photo validation: scheduled_start={scheduled_start_epoch}, now={now}')
    logger.info(f'Photo validation: scheduled_time={time.strftime("%H:%M", time.gmtime(scheduled_start_epoch + CO_TZ_OFFSET_SECONDS))}, current_time={time.strftime("%H:%M", time.gmtime(now + CO_TZ_OFFSET_SECONDS))}')

    t_local = time.gmtime(scheduled_start_epoch + CO_TZ_OFFSET_SECONDS)
    session_midnight_utc = scheduled_start_epoch - (t_local.tm_hour * 3600 + t_local.tm_min * 60 + t_local.tm_sec)

    # Permitir foto 30 minutos antes hasta las 23:00 del día de la clase
    allowed_start = scheduled_start_epoch - (30 * 60)  # 30 minutos antes
    allowed_end = session_midnight_utc + (23 * 60 * 60)

    logger.info(f'Photo validation: allowed_start={allowed_start}, allowed_end={allowed_end}')

    if now < allowed_start:
        logger.warning(f'Photo too early: now={now}, allowed_start={allowed_start}')
        return _response(400, {
            'error': 'TooEarlyForPhoto', 
            'message': 'La foto solo puede tomarse 30 minutos antes de la clase.',
            'scheduledTime': time.strftime('%H:%M', time.gmtime(scheduled_start_epoch))
        })

    if now > allowed_end:
        logger.warning(f'Photo too late: now={now}, allowed_end={allowed_end}')
        return _response(400, {
            'error': 'TooLateForPhoto', 
            'message': 'La foto solo puede tomarse hasta las 11:00 p. m. del día de la clase.',
            'scheduledTime': time.strftime('%H:%M', time.gmtime(scheduled_start_epoch + CO_TZ_OFFSET_SECONDS))
        })

    logger.info('Photo validation passed: time is within allowed range')

    class_id = (_ddb_s(session_item, 'ClassId') or '').strip()
    if not class_id:
        return _response(400, {'error': 'InvalidSessionClassId'})

    corte_val = corte_override or (_ddb_s(session_item, 'Corte') or '').strip()

    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (confirm-attendance-photo class)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    class_teacher = (_ddb_s(class_item, 'TeacherEmail') or '').strip().lower()
    if class_teacher and class_teacher != teacher:
        return _response(403, {'error': 'Forbidden'})

    image_bytes = _normalize_b64_image(str(image_b64))
    if not image_bytes:
        return _response(400, {'error': 'Invalid base64 image'})

    img = None
    image_bytes_fixed = image_bytes
    if PIL_AVAILABLE:
        try:
            img = _load_image(image_bytes)
            image_bytes_fixed = _bytes_from_pil(img)
        except Exception:
            img = None
            image_bytes_fixed = image_bytes

    try:
        enroll_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #CID = :cid',
            ExpressionAttributeNames={'#T': 'Type', '#CID': 'ClassId'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':cid': {'S': class_id}},
            Limit=400,
        )
    except Exception as e:
        logger.exception('DynamoDB scan failed (confirm-attendance-photo enrollments)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    enroll_items = (enroll_scan or {}).get('Items') or []
    roster_emails = []
    roster_by_email = {}
    seen = set()
    for en in enroll_items:
        se = (_ddb_s(en, 'StudentEmail') or '').strip().lower()
        if not se or se in seen:
            continue
        seen.add(se)
        roster_emails.append(se)
        roster_by_email[se] = {
            'studentEmail': se,
            'studentName': _ddb_s(en, 'StudentName') or None,
            'studentCode': _ddb_s(en, 'StudentCode') or None,
        }

    def _resolve_faceid_to_email(face_id: str) -> str | None:
        try:
            ddb_resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': str(face_id)}}
            )
            it = (ddb_resp or {}).get('Item')
        except Exception:
            it = None

        if not it:
            return None
        email_found = (_ddb_s(it, 'Email') or '').strip().lower()
        return email_found or None

    try:
        detect_resp = rekognition.detect_faces(Image={'Bytes': image_bytes_fixed}, Attributes=['DEFAULT'])
        face_details = detect_resp.get('FaceDetails', []) or []
    except Exception as e:
        logger.exception('Rekognition detect_faces failed (confirm-attendance-photo)')
        return _response(500, {'error': 'DetectFacesFailed', 'details': str(e)})

    face_count = len(face_details)
    present_set = set()

    def _search_best_email(img_bytes: bytes) -> str | None:
        try:
            sresp = rekognition.search_faces_by_image(
                CollectionId=COLLECTION,
                Image={'Bytes': img_bytes},
                FaceMatchThreshold=FACE_MATCH_THRESHOLD,
                MaxFaces=MAX_MATCHES,
            )
        except Exception:
            return None

        matches = sresp.get('FaceMatches', []) or []
        if not matches:
            return None

        best = sorted(matches, key=lambda m: float(m.get('Similarity') or 0.0), reverse=True)[0]
        face = best.get('Face') or {}
        face_id = face.get('FaceId')
        if not face_id:
            return None
        return _resolve_faceid_to_email(str(face_id))

    def _search_best_email_with_score(img_bytes: bytes) -> dict | None:
        """Igual que _search_best_email pero devuelve dict con email, score y face_id para logging."""
        try:
            sresp = rekognition.search_faces_by_image(
                CollectionId=COLLECTION,
                Image={'Bytes': img_bytes},
                FaceMatchThreshold=FACE_MATCH_THRESHOLD,
                MaxFaces=MAX_MATCHES,
            )
        except Exception as e:
            logger.warning(f'search_faces_by_image excepcion: {e}')
            return None

        matches = sresp.get('FaceMatches', []) or []
        if not matches:
            return None

        best = sorted(matches, key=lambda m: float(m.get('Similarity') or 0.0), reverse=True)[0]
        similarity = float(best.get('Similarity') or 0.0)
        face = best.get('Face') or {}
        face_id = face.get('FaceId')
        if not face_id:
            return None
        email = _resolve_faceid_to_email(str(face_id))
        return {'email': email, 'similarity': similarity, 'face_id': face_id, 'matches_count': len(matches)}

    logger.info(f'confirm-attendance-photo: rostros_detectados={face_count}, umbral={FACE_MATCH_THRESHOLD}')

    if face_count and PIL_AVAILABLE and img is not None:
        for idx, fd in enumerate(face_details):
            bb = (fd or {}).get('BoundingBox') or {}
            try:
                cropped_bytes = _crop_face_bytes(img, bb)
            except Exception:
                cropped_bytes = image_bytes_fixed

            result = _search_best_email_with_score(cropped_bytes)
            if result:
                logger.info(f'confirm-attendance-photo: rostro_idx={idx}, email={result["email"]}, similarity={result["similarity"]:.2f}, matches={result["matches_count"]}, in_roster={result["email"] in roster_by_email}')
                if result['email'] and result['email'] in roster_by_email:
                    present_set.add(result['email'])
            else:
                logger.info(f'confirm-attendance-photo: rostro_idx={idx}, sin_coincidencias')
    else:
        logger.info(f'confirm-attendance-photo: fallback_imagen_completa (PIL={PIL_AVAILABLE}, face_count={face_count})')
        result = _search_best_email_with_score(image_bytes_fixed)
        if result:
            logger.info(f'confirm-attendance-photo: imagen_completa, email={result["email"]}, similarity={result["similarity"]:.2f}, matches={result["matches_count"]}, in_roster={result["email"] in roster_by_email}')
            if result['email'] and result['email'] in roster_by_email:
                present_set.add(result['email'])
        else:
            logger.info('confirm-attendance-photo: imagen_completa, sin_coincidencias')

    updated = 0
    results = []
    class_name = _ddb_s(class_item, 'ClassName') or class_id
    scheduled_start = int((_ddb_n(session_item, 'ScheduledStartEpoch') or '0') or 0)
    late_after = int((_ddb_n(session_item, 'LateAfterSeconds') or str(15 * 60)) or str(15 * 60))
    photo_status = 'asistencia'
    if scheduled_start and (now - scheduled_start) > late_after:
        photo_status = 'retardo'

    for se in roster_emails:
        attend_pk = f"ATTEND#{session_id}#{se}".lower()
        attend_item = None
        try:
            attend_resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': attend_pk}}
            )
            attend_item = (attend_resp or {}).get('Item')
        except Exception:
            attend_item = None

        status = 'inasistencia'
        marked_at = None
        if attend_item:
            status = _normalize_attendance_status(_ddb_s(attend_item, 'Status') or 'inasistencia')
            marked_at = _ddb_n(attend_item, 'MarkedAt') or None

        in_photo = se in present_set
        should_downgrade = not in_photo
        if should_downgrade and face_count == 1 and len(present_set) == 0:
            logger.info(f'confirm-attendance-photo: protegiendo_estado={status} para {se} (1 rostro sin identificar)')
            should_downgrade = False

        final_status = status
        now_ts = int(time.time())
        if in_photo:
            if status not in ('asistencia', 'retardo'):
                final_status = photo_status
            else:
                final_status = status
        elif should_downgrade:
            final_status = 'inasistencia'

        base_info = roster_by_email.get(se) or {'studentEmail': se}
        att_item = {
            'RekognitionId': {'S': attend_pk},
            'Type': {'S': 'Attendance'},
            'SessionId': {'S': session_id},
            'ClassId': {'S': class_id},
            'TeacherEmail': {'S': teacher},
            'StudentEmail': {'S': se},
            'MarkedAt': {'N': str(marked_at or now_ts)},
            'Status': {'S': final_status},
            'Method': {'S': 'face' if in_photo else (_ddb_s(attend_item, 'Method') if attend_item else 'photo')},
            'PhotoConfirmedAt': {'N': str(now_ts)},
        }
        if base_info.get('studentName'):
            att_item['StudentName'] = {'S': str(base_info.get('studentName'))}
        if base_info.get('studentCode'):
            att_item['StudentCode'] = {'S': str(base_info.get('studentCode'))}
        if in_photo:
            att_item['PresentInPhoto'] = {'BOOL': True}

        try:
            dynamodb.put_item(TableName=DDB_TABLE, Item=att_item)
            if final_status != status:
                updated += 1
        except Exception:
            logger.exception('DynamoDB put_item failed (confirm-attendance-photo attend)')

        _notify_student_attendance(se, session_id, class_id, class_name, final_status, now_ts, 'photo')

        results.append({
            'studentEmail': se,
            'studentName': base_info.get('studentName'),
            'studentCode': base_info.get('studentCode'),
            'status': final_status,
            'markedAt': marked_at or now_ts,
            'presentInPhoto': in_photo,
        })

    # Lock the session to avoid later QR scans flipping statuses after photo confirmation.
    try:
        now_ts = int(time.time())
        dynamodb.update_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"ATTSESSION#{session_id}"}},
            UpdateExpression='SET #PC = :pc',
            ExpressionAttributeNames={'#PC': 'PhotoConfirmedAt'},
            ExpressionAttributeValues={':pc': {'N': str(now_ts)}},
        )
    except Exception:
        pass

    return _response(200, {
        'ok': True,
        'sessionId': session_id,
        'classId': class_id,
        'facesDetected': face_count,
        'presentCount': len(present_set),
        'downgradedToInasistencia': updated,
        'results': results,
    })

def handle_attendance_report(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    teacher = str(payload.get('sub') or '').strip().lower()
    session_id = (body.get('sessionId') or '').strip()
    class_id_in = (body.get('classId') or '').strip()
    report_mode = str(body.get('mode') or body.get('reportType') or 'session').strip().lower()
    corte_override = (body.get('corte') or '').strip()
    if not session_id and not class_id_in:
        return _response(400, {'error': 'Missing field: sessionId or classId'})

    if class_id_in and not session_id:
        try:
            class_resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': f'CLASS#{class_id_in}'}},
            )
            class_item = (class_resp or {}).get('Item')
        except Exception as e:
            logger.exception('DynamoDB get_item failed (attendance-report classId)')
            return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})
        if not class_item:
            return _response(404, {'error': 'ClassNotFound'})
        class_teacher = (_ddb_s(class_item, 'TeacherEmail') or '').strip().lower()
        if class_teacher and class_teacher != teacher:
            return _response(403, {'error': 'Forbidden'})

        try:
            enroll_items = _ddb_scan_all(
                '#T = :t AND #CID = :cid',
                {'#T': 'Type', '#CID': 'ClassId'},
                {':t': {'S': 'Enrollment'}, ':cid': {'S': class_id_in}},
            )
            sess_items = _ddb_scan_all(
                '#T = :t AND #CID = :cid',
                {'#T': 'Type', '#CID': 'ClassId'},
                {':t': {'S': 'AttendanceSession'}, ':cid': {'S': class_id_in}},
            )
            att_items = _ddb_scan_all(
                '#T = :t AND #CID = :cid',
                {'#T': 'Type', '#CID': 'ClassId'},
                {':t': {'S': 'Attendance'}, ':cid': {'S': class_id_in}},
            )
        except Exception as e:
            logger.exception('DynamoDB scan failed (attendance-report class)')
            return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

        roster_emails = []
        roster_by_email = {}
        seen = set()
        for en in enroll_items:
            se = (_ddb_s(en, 'StudentEmail') or '').strip().lower()
            if not se or se in seen:
                continue
            seen.add(se)
            roster_emails.append(se)
            roster_by_email[se] = {
                'studentEmail': se,
                'studentName': _ddb_s(en, 'StudentName') or '',
                'studentCode': _ddb_s(en, 'StudentCode') or '',
            }

        sessions = []
        for it in sess_items:
            sid = (_ddb_s(it, 'SessionId') or '').strip()
            if not sid:
                continue
            sessions.append({
                'sessionId': sid,
                'sessionDate': _ddb_s(it, 'SessionDate') or '',
                'corte': _ddb_s(it, 'Corte') or corte_override,
                'epoch': int((_ddb_n(it, 'ScheduledStartEpoch') or '0') or '0'),
            })
        sessions.sort(key=lambda s: (s.get('sessionDate') or '', s.get('epoch') or 0, s.get('sessionId') or ''))

        att_by_sess_email = {}
        for it in att_items:
            se = (_ddb_s(it, 'StudentEmail') or '').strip().lower()
            sid = (_ddb_s(it, 'SessionId') or '').strip()
            if not se or not sid:
                continue
            att_by_sess_email[(sid, se)] = _normalize_attendance_status(_ddb_s(it, 'Status'))

        teacher_name = ''
        teacher_code = ''
        try:
            t_resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': f'USER#{teacher}'}},
            )
            t_item = (t_resp or {}).get('Item')
            if t_item:
                teacher_name = _ddb_s(t_item, 'FullName')
                teacher_code = _ddb_s(t_item, 'TeacherCode')
        except Exception:
            pass

        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(['Nombre_Asignatura', _ddb_s(class_item, 'ClassName')])
        w.writerow(['Código_Asignatura', _ddb_s(class_item, 'SubjectCode')])
        w.writerow(['Grupo', _ddb_s(class_item, 'Group')])
        w.writerow(['Periodo', _ddb_s(class_item, 'Period')])
        w.writerow(['Cédula_Docente', teacher_code])
        w.writerow(['Nombre_Docente', teacher_name])
        w.writerow(['#_Estudiantes', str(len(roster_emails))])
        w.writerow(['#_Sesiones', str(len(sessions))])
        w.writerow(['Tipo_Informe', 'Resumen general' if report_mode != 'detail' else 'Detalle por sesión'])
        w.writerow([])

        if report_mode == 'detail':
            w.writerow(['#', 'CÓDIGO_ESTUDIANTE', 'NOMBRE_ESTUDIANTE', 'CORREO', 'CORTE', 'SI', 'NO', 'RETARDO', 'SESION', 'FECHA_CATEDRA', 'OBSERVACIONES'])
            row_n = 0
            for sess in sessions:
                for se in sorted(roster_emails):
                    row_n += 1
                    st = att_by_sess_email.get((sess['sessionId'], se), 'inasistencia')
                    info = roster_by_email.get(se) or {}
                    w.writerow([
                        str(row_n),
                        info.get('studentCode') or '',
                        info.get('studentName') or '',
                        se,
                        sess.get('corte') or '',
                        'X' if st == 'asistencia' else '',
                        'X' if st == 'inasistencia' else '',
                        'X' if st == 'retardo' else '',
                        sess.get('sessionId') or '',
                        sess.get('sessionDate') or '',
                        '',
                    ])
        else:
            w.writerow(['#', 'CÓDIGO_ESTUDIANTE', 'NOMBRE_ESTUDIANTE', 'CORREO', 'SESIONES', 'ASISTENCIA', 'RETARDO', 'FALLAS', 'PORCENTAJE'])
            for idx, se in enumerate(sorted(roster_emails), start=1):
                present = late = absent = 0
                for sess in sessions:
                    st = att_by_sess_email.get((sess['sessionId'], se), 'inasistencia')
                    if st == 'asistencia':
                        present += 1
                    elif st == 'retardo':
                        late += 1
                    else:
                        absent += 1
                total = max(len(sessions), 1)
                pct = int(round(((present + late) / total) * 100)) if sessions else 0
                info = roster_by_email.get(se) or {}
                w.writerow([
                    str(idx),
                    info.get('studentCode') or '',
                    info.get('studentName') or '',
                    se,
                    str(len(sessions)),
                    str(present),
                    str(late),
                    str(absent),
                    f'{pct}%',
                ])

        csv_text = out.getvalue()
        filename = f"reporte_clase_{class_id_in}_{report_mode or 'summary'}.csv"
        return _response_text(
            200,
            csv_text,
            content_type='text/csv; charset=utf-8',
            extra_headers={'Content-Disposition': f'attachment; filename="{filename}"'},
        )

    try:
        session_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"ATTSESSION#{session_id}"}}
        )
        session_item = (session_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (attendance-report session)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not session_item:
        return _response(404, {'error': 'SessionNotFound'})

    corte_val = (corte_override or (_ddb_s(session_item, 'Corte') or '')).strip()

    if (_ddb_s(session_item, 'TeacherEmail') or '').strip().lower() != teacher:
        return _response(403, {'error': 'Forbidden'})

    class_id = (_ddb_s(session_item, 'ClassId') or '').strip()
    if not class_id:
        return _response(400, {'error': 'InvalidSessionClassId'})

    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (attendance-report class)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    class_teacher = (_ddb_s(class_item, 'TeacherEmail') or '').strip().lower()
    if class_teacher and class_teacher != teacher:
        return _response(403, {'error': 'Forbidden'})

    # Build roster
    try:
        enroll_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #CID = :cid',
            ExpressionAttributeNames={'#T': 'Type', '#CID': 'ClassId'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':cid': {'S': class_id}},
            Limit=600,
        )
    except Exception as e:
        logger.exception('DynamoDB scan failed (attendance-report enrollments)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    enroll_items = (enroll_scan or {}).get('Items') or []
    roster_emails = []
    roster_by_email = {}
    seen = set()
    for en in enroll_items:
        se = (_ddb_s(en, 'StudentEmail') or '').strip().lower()
        if not se or se in seen:
            continue
        seen.add(se)
        roster_emails.append(se)
        roster_by_email[se] = {
            'studentEmail': se,
            'studentName': _ddb_s(en, 'StudentName') or None,
            'studentCode': _ddb_s(en, 'StudentCode') or None,
        }

    # Build attendance lookup
    try:
        attend_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #SID = :sid',
            ExpressionAttributeNames={'#T': 'Type', '#SID': 'SessionId'},
            ExpressionAttributeValues={':t': {'S': 'Attendance'}, ':sid': {'S': session_id}},
            Limit=900,
        )
        attend_items = (attend_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (attendance-report attendances)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    status_by_email = {}
    for it in attend_items:
        se = (_ddb_s(it, 'StudentEmail') or '').strip().lower()
        if not se:
            continue
        status_by_email[se] = (_ddb_s(it, 'Status') or '').strip().lower() or 'inasistencia'

    # Teacher profile for report header
    teacher_name = ''
    teacher_code = ''
    try:
        t_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"USER#{teacher}"}}
        )
        t_item = (t_resp or {}).get('Item')
        if t_item:
            teacher_name = _ddb_s(t_item, 'FullName')
            teacher_code = _ddb_s(t_item, 'TeacherCode')
    except Exception:
        teacher_name = ''
        teacher_code = ''

    subject_code = _ddb_s(class_item, 'SubjectCode')
    period = _ddb_s(class_item, 'Period')

    out = io.StringIO()
    w = csv.writer(out)
    # Header like template (two columns: label/value)
    w.writerow(['Nombre_Asignatura', _ddb_s(class_item, 'ClassName')])
    w.writerow(['Código_Asignatura', subject_code])
    w.writerow(['Grupo', _ddb_s(class_item, 'Group')])
    w.writerow(['Periodo', period])
    w.writerow(['Cédula_Docente', teacher_code])
    w.writerow(['Nombre_Docente', teacher_name])
    w.writerow(['#_Estudiantes', str(len(roster_emails))])
    w.writerow([])

    # Table header
    w.writerow(['#', 'CÓDIGO_ESTUDIANTE', 'NOMBRE_ESTUDIANTE', 'CORREO', 'CORTE', 'SI', 'NO', 'RETARDO', 'SESION', 'FECHA_CATEDRA', 'OBSERVACIONES'])

    for idx, se in enumerate(sorted(roster_emails), start=1):
        base_info = roster_by_email.get(se) or {'studentEmail': se}
        st = status_by_email.get(se, 'inasistencia')
        si = 'X' if st == 'asistencia' else ''
        no = 'X' if st == 'inasistencia' else ''
        ret = 'X' if st == 'retardo' else ''
        w.writerow([
            str(idx),
            base_info.get('studentCode') or '',
            base_info.get('studentName') or '',
            se,
            corte_val,
            si,
            no,
            ret,
            session_id,
            _ddb_s(session_item, 'SessionDate'),
            '',
        ])

    csv_text = out.getvalue()
    filename = f"reporte_asistencia_{class_id}_{session_id}.csv"
    return _response_text(
        200,
        csv_text,
        content_type='text/csv; charset=utf-8',
        extra_headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )

def handle_student_daily_summary(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'student':
        return _response(401, {'error': 'Unauthorized'})

    student_email = str(payload.get('sub') or '').strip().lower()
    if not student_email:
        return _response(401, {'error': 'Unauthorized'})

    now = int(time.time())
    session_date = time.strftime('%Y-%m-%d', time.gmtime(now + CO_TZ_OFFSET_SECONDS))

    # Enrollments for this student
    try:
        enroll_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #SE = :se',
            ExpressionAttributeNames={'#T': 'Type', '#SE': 'StudentEmail'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':se': {'S': student_email}},
            Limit=500,
        )
        enroll_items = (enroll_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (student-daily-summary enrollments)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    enrolled_class_ids = set()
    for en in enroll_items:
        cid = (_ddb_s(en, 'ClassId') or '').strip()
        if cid:
            enrolled_class_ids.add(cid)

    if not enrolled_class_ids:
        return _response(200, {
            'ok': True,
            'date': session_date,
            'studentEmail': student_email,
            'summary': {'asistencia': 0, 'retardo': 0, 'inasistencia': 0},
            'totals': _count_student_attendance_totals(student_email),
            'classesCount': 0,
            'sessions': [],
        })

    # Fetch all sessions today and filter to enrolled classes
    try:
        sess_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #SD = :sd',
            ExpressionAttributeNames={'#T': 'Type', '#SD': 'SessionDate'},
            ExpressionAttributeValues={':t': {'S': 'AttendanceSession'}, ':sd': {'S': session_date}},
            Limit=800,
        )
        sess_items = (sess_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (student-daily-summary sessions)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    sessions = []
    counts = {'asistencia': 0, 'retardo': 0, 'inasistencia': 0}

    for s in sess_items:
        class_id = (_ddb_s(s, 'ClassId') or '').strip()
        if not class_id or class_id not in enrolled_class_ids:
            continue
        session_id = (_ddb_s(s, 'SessionId') or '').strip()
        if not session_id:
            continue

        # Attendance record for this student in this session
        status = 'inasistencia'
        marked_at = None
        try:
            att_pk = f"ATTEND#{session_id}#{student_email}".lower()
            att_resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': att_pk}},
            )
            att_item = (att_resp or {}).get('Item')
            if att_item:
                status = _normalize_attendance_status(_ddb_s(att_item, 'Status') or 'inasistencia')
                marked_at = _ddb_n(att_item, 'MarkedAt') or None
        except Exception:
            status = status
            marked_at = marked_at

        if status not in counts:
            status = 'inasistencia'
        counts[status] = int(counts.get(status, 0)) + 1

        # Class info (best effort)
        class_name = None
        group = None
        start_time = None
        end_time = None
        try:
            class_resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': f"CLASS#{class_id}"}},
            )
            class_item = (class_resp or {}).get('Item')
            if class_item:
                class_name = _ddb_s(class_item, 'ClassName') or None
                group = _ddb_s(class_item, 'Group') or None
                start_time = _ddb_s(class_item, 'StartTime') or None
                end_time = _ddb_s(class_item, 'EndTime') or None
        except Exception:
            pass

        sessions.append({
            'sessionId': session_id,
            'classId': class_id,
            'className': class_name,
            'group': group,
            'startTime': start_time,
            'endTime': end_time,
            'status': status,
            'markedAt': marked_at,
            'photoConfirmedAt': _ddb_n(s, 'PhotoConfirmedAt') or None,
        })

    # Sort by startTime if present
    try:
        sessions = sorted(sessions, key=lambda it: (str(it.get('startTime') or '99:99'), str(it.get('className') or '')))
    except Exception:
        sessions = sessions

    totals = _count_student_attendance_totals(student_email)

    return _response(200, {
        'ok': True,
        'date': session_date,
        'studentEmail': student_email,
        'summary': counts,
        'totals': totals,
        'classesCount': len(enrolled_class_ids),
        'sessions': sessions,
    })

def handle_student_notifications(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'student':
        return _response(401, {'error': 'Unauthorized'})

    student_email = str(payload.get('sub') or '').strip().lower()
    if not student_email:
        return _response(401, {'error': 'Unauthorized'})

    now = int(time.time())
    session_date = time.strftime('%Y-%m-%d', time.gmtime(now + CO_TZ_OFFSET_SECONDS))

    # Enrollments for this student
    try:
        enroll_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #SE = :se',
            ExpressionAttributeNames={'#T': 'Type', '#SE': 'StudentEmail'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':se': {'S': student_email}},
            Limit=500,
        )
        enroll_items = (enroll_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (student-notifications enrollments)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    enrolled_class_ids = set((_ddb_s(en, 'ClassId') or '').strip() for en in enroll_items)
    enrolled_class_ids = set(cid for cid in enrolled_class_ids if cid)
    if not enrolled_class_ids:
        return _response(200, {'ok': True, 'date': session_date, 'notifications': []})

    try:
        sess_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #SD = :sd',
            ExpressionAttributeNames={'#T': 'Type', '#SD': 'SessionDate'},
            ExpressionAttributeValues={':t': {'S': 'AttendanceSession'}, ':sd': {'S': session_date}},
            Limit=800,
        )
        sess_items = (sess_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (student-notifications sessions)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    notifications = []
    seen = set()

    def _add_notif(n: dict):
        nid = str((n or {}).get('id') or '')
        if not nid or nid in seen:
            return
        seen.add(nid)
        notifications.append(n)

    today_key = _today_weekday_name_co()
    now_co = datetime.datetime.utcfromtimestamp(now + CO_TZ_OFFSET_SECONDS)
    now_min = int(now_co.hour) * 60 + int(now_co.minute)
    class_cache = {}

    for cid in enrolled_class_ids:
        try:
            class_resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': f'CLASS#{cid}'}},
            )
            class_item = (class_resp or {}).get('Item')
        except Exception:
            class_item = None
        class_cache[cid] = class_item
        if not class_item:
            continue
        class_name = _ddb_s(class_item, 'ClassName') or 'la clase'
        starts = []
        schedule = _ddb_schedule(class_item, 'Schedule')
        if schedule:
            for block in schedule:
                day_key = _normalize_weekday_name(block.get('day') or '')
                if day_key == today_key:
                    starts.append(str(block.get('startTime') or ''))
        else:
            st0 = _ddb_s(class_item, 'StartTime')
            if st0:
                starts.append(st0)
        for st in starts:
            mins = _hhmm_to_minutes(st)
            if mins is None:
                continue
            diff = mins - now_min
            if 0 <= diff <= 30:
                _add_notif(_upsert_student_notification(
                    student_email,
                    f'NOTIF#soon#{cid}#{session_date}'.lower(),
                    'Clase por comenzar',
                    f'{class_name} empieza a las {st}. Quedan {diff} min.',
                    'info',
                    now,
                    extra={'ClassId': cid, 'ClassName': class_name},
                    keep_created=True,
                ))

    for s in sess_items:
        class_id = (_ddb_s(s, 'ClassId') or '').strip()
        if not class_id or class_id not in enrolled_class_ids:
            continue
        session_id = (_ddb_s(s, 'SessionId') or '').strip()
        if not session_id:
            continue

        class_item = class_cache.get(class_id)
        class_name = _ddb_s(class_item, 'ClassName') if class_item else class_id
        status = 'inasistencia'
        try:
            att_pk = f'ATTEND#{session_id}#{student_email}'.lower()
            att_resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': att_pk}},
            )
            att_item = (att_resp or {}).get('Item')
            if att_item:
                status = _normalize_attendance_status(_ddb_s(att_item, 'Status') or 'inasistencia')
        except Exception:
            status = 'inasistencia'

        photo_confirmed_at = _ddb_n(s, 'PhotoConfirmedAt')
        scheduled_start = int((_ddb_n(s, 'ScheduledStartEpoch') or '0') or 0)
        late_after = int((_ddb_n(s, 'LateAfterSeconds') or str(15 * 60)) or str(15 * 60))
        absent_ready = bool(photo_confirmed_at) or bool(scheduled_start and now >= (scheduled_start + late_after))

        if status == 'asistencia':
            _add_notif(_upsert_student_notification(
                student_email,
                f'NOTIF#att#{session_id}#{student_email}'.lower(),
                'Asistencia registrada',
                f'Tu asistencia en {class_name or "la clase"} quedó registrada.',
                'success',
                now,
                extra={'ClassId': class_id, 'SessionId': session_id, 'ClassName': class_name or ''},
                keep_created=True,
            ))
        elif status == 'retardo':
            _add_notif(_upsert_student_notification(
                student_email,
                f'NOTIF#att#{session_id}#{student_email}'.lower(),
                'Retardo registrado',
                f'Llegaste tarde a {class_name or "la clase"}. Quedó marcado como retardo.',
                'warning',
                now,
                extra={'ClassId': class_id, 'SessionId': session_id, 'ClassName': class_name or ''},
                keep_created=True,
            ))
        elif absent_ready:
            _add_notif(_upsert_student_notification(
                student_email,
                f'NOTIF#att#{session_id}#{student_email}'.lower(),
                'Inasistencia',
                f'No se registró tu asistencia en {class_name or "la clase"}.',
                'attendance',
                now,
                extra={'ClassId': class_id, 'SessionId': session_id, 'ClassName': class_name or ''},
                keep_created=True,
            ))
            if photo_confirmed_at:
                _add_notif(_upsert_student_notification(
                    student_email,
                    f'NOTIF#photo#{session_id}#{student_email}'.lower(),
                    'No reconocido por foto',
                    f'No fuiste reconocido por foto en {class_name or "la clase"}.',
                    'warning',
                    now,
                    extra={'ClassId': class_id, 'SessionId': session_id, 'ClassName': class_name or ''},
                    keep_created=True,
                ))

    try:
        stored_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #SE = :se',
            ExpressionAttributeNames={'#T': 'Type', '#SE': 'StudentEmail'},
            ExpressionAttributeValues={':t': {'S': 'Notification'}, ':se': {'S': student_email}},
            Limit=200,
        )
        for it in (stored_scan or {}).get('Items') or []:
            _add_notif(_notification_from_item(it, now))
    except Exception:
        pass

    try:
        notifications = sorted(
            notifications,
            key=lambda n: int(n.get('createdAt') or 0),
            reverse=True,
        )
    except Exception:
        pass
    notifications = notifications[:50]

    return _response(200, {
        'ok': True,
        'date': session_date,
        'studentEmail': student_email,
        'notifications': notifications,
        'unreadCount': sum(1 for n in notifications if not n.get('read')),
    })

def handle_mark_notifications_read(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'student':
        return _response(401, {'error': 'Unauthorized'})

    student_email = str(payload.get('sub') or '').strip().lower()
    if not student_email:
        return _response(401, {'error': 'Unauthorized'})

    mark_all = bool(body.get('all') or body.get('markAll')) if isinstance(body, dict) else False
    ids = body.get('ids') if isinstance(body, dict) else None
    if not isinstance(ids, list):
        ids = [body.get('id')] if isinstance(body, dict) and body.get('id') else []
    ids = [str(x).strip() for x in ids if str(x or '').strip()]

    updated = 0
    targets = list(ids)
    if mark_all:
        try:
            scan_resp = dynamodb.scan(
                TableName=DDB_TABLE,
                FilterExpression='#T = :t AND #SE = :se',
                ExpressionAttributeNames={'#T': 'Type', '#SE': 'StudentEmail'},
                ExpressionAttributeValues={':t': {'S': 'Notification'}, ':se': {'S': student_email}},
                Limit=200,
            )
            targets = [_ddb_s(it, 'RekognitionId') for it in ((scan_resp or {}).get('Items') or [])]
            targets = [t for t in targets if t]
        except Exception as e:
            logger.exception('DynamoDB scan failed (mark-notifications-read)')
            return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    for nid in targets:
        try:
            resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': nid}},
            )
            item = (resp or {}).get('Item')
            if not item:
                continue
            owner = (_ddb_s(item, 'StudentEmail') or '').strip().lower()
            if owner != student_email:
                continue
            dynamodb.update_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': nid}},
                UpdateExpression='SET #R = :t',
                ExpressionAttributeNames={'#R': 'Read'},
                ExpressionAttributeValues={':t': {'BOOL': True}},
            )
            updated += 1
        except Exception:
            continue

    return _response(200, {'ok': True, 'updated': updated})

def handle_student_attendance_history(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'student':
        return _response(401, {'error': 'Unauthorized'})

    student_email = str(payload.get('sub') or '').strip().lower()
    if not student_email:
        return _response(401, {'error': 'Unauthorized'})

    try:
        enroll_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #SE = :se',
            ExpressionAttributeNames={'#T': 'Type', '#SE': 'StudentEmail'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':se': {'S': student_email}},
            Limit=500,
        )
        enroll_items = (enroll_scan or {}).get('Items') or []
    except Exception as e:
        logger.exception('DynamoDB scan failed (student-attendance-history enrollments)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    enrolled_class_ids = set()
    for en in enroll_items:
        cid = (_ddb_s(en, 'ClassId') or '').strip()
        if cid:
            enrolled_class_ids.add(cid)

    if not enrolled_class_ids:
        return _response(200, {'ok': True, 'records': [], 'summary': {
            'present': 0, 'late': 0, 'absent': 0, 'total': 0,
        }})

    months_es = ('Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic')

    def _fmt_date_es(ymd: str) -> str:
        parts = str(ymd or '').split('-')
        if len(parts) != 3:
            return str(ymd or '')
        try:
            y, m, d = parts[0], int(parts[1]), int(parts[2])
            if 1 <= m <= 12:
                return f'{d:02d} {months_es[m - 1]} {y}'
        except Exception:
            return str(ymd or '')
        return str(ymd or '')

    def _fmt_time(raw: str) -> str:
        s = str(raw or '').strip()
        m = re.match(r'^(\d{1,2}):(\d{2})', s)
        if not m:
            return s
        hh = int(m.group(1))
        mm = int(m.group(2))
        suffix = 'AM' if hh < 12 else 'PM'
        h12 = hh % 12 or 12
        return f'{h12:02d}:{mm:02d} {suffix}'

    def _ui_status(raw: str) -> str:
        st = str(raw or '').strip().lower()
        if st in ('asistencia', 'presente', 'present', 'ok'):
            return 'present'
        if st in ('retardo', 'late', 'tardanza'):
            return 'late'
        return 'absent'

    sess_items = []
    last_key = None
    try:
        for _ in range(0, 8):
            kwargs = {
                'TableName': DDB_TABLE,
                'FilterExpression': '#T = :t',
                'ExpressionAttributeNames': {'#T': 'Type'},
                'ExpressionAttributeValues': {':t': {'S': 'AttendanceSession'}},
                'Limit': 400,
            }
            if last_key:
                kwargs['ExclusiveStartKey'] = last_key
            sess_scan = dynamodb.scan(**kwargs)
            for it in (sess_scan or {}).get('Items') or []:
                cid = (_ddb_s(it, 'ClassId') or '').strip()
                if cid in enrolled_class_ids:
                    sess_items.append(it)
            last_key = (sess_scan or {}).get('LastEvaluatedKey')
            if not last_key:
                break
    except Exception as e:
        logger.exception('DynamoDB scan failed (student-attendance-history sessions)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    class_cache = {}
    teacher_cache = {}
    records = []

    for s in sess_items:
        class_id = (_ddb_s(s, 'ClassId') or '').strip()
        session_id = (_ddb_s(s, 'SessionId') or '').strip()
        session_date = (_ddb_s(s, 'SessionDate') or '').strip()
        if not class_id or not session_id:
            continue

        if class_id not in class_cache:
            class_name = None
            teacher_email = (_ddb_s(s, 'TeacherEmail') or '').strip().lower()
            start_time = None
            try:
                class_resp = dynamodb.get_item(
                    TableName=DDB_TABLE,
                    Key={'RekognitionId': {'S': f'CLASS#{class_id}'}},
                )
                class_item = (class_resp or {}).get('Item')
                if class_item:
                    class_name = _ddb_s(class_item, 'ClassName') or None
                    teacher_email = (_ddb_s(class_item, 'TeacherEmail') or teacher_email).strip().lower()
                    start_time = _ddb_s(class_item, 'StartTime') or None
            except Exception:
                class_item = None
            class_cache[class_id] = {
                'className': class_name,
                'teacherEmail': teacher_email,
                'startTime': start_time,
            }
        class_info = class_cache[class_id]
        teacher_email = class_info.get('teacherEmail') or ''

        if teacher_email and teacher_email not in teacher_cache:
            tname = teacher_email
            try:
                t_resp = dynamodb.get_item(
                    TableName=DDB_TABLE,
                    Key={'RekognitionId': {'S': f'USER#{teacher_email}'}},
                )
                t_item = (t_resp or {}).get('Item')
                if t_item:
                    tname = _ddb_s(t_item, 'FullName') or teacher_email
            except Exception:
                tname = teacher_email
            teacher_cache[teacher_email] = tname
        teacher_name = teacher_cache.get(teacher_email) or teacher_email or 'Docente'

        status_raw = 'inasistencia'
        marked_at = None
        try:
            att_pk = f'ATTEND#{session_id}#{student_email}'.lower()
            att_resp = dynamodb.get_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': att_pk}},
            )
            att_item = (att_resp or {}).get('Item')
            if att_item:
                status_raw = (_ddb_s(att_item, 'Status') or 'inasistencia').strip().lower()
                marked_at = _ddb_n(att_item, 'MarkedAt') or None
        except Exception:
            status_raw = 'inasistencia'

        ui_status = _ui_status(status_raw)
        records.append({
            'id': f'{session_id}#{student_email}',
            'sessionId': session_id,
            'classId': class_id,
            'subject': class_info.get('className') or class_id,
            'professor': teacher_name,
            'date': _fmt_date_es(session_date),
            'dateRaw': session_date,
            'time': _fmt_time(class_info.get('startTime') or ''),
            'status': ui_status,
            'statusRaw': status_raw,
            'markedAt': int(marked_at) if str(marked_at or '').isdigit() else None,
        })

    try:
        records = sorted(
            records,
            key=lambda it: (str(it.get('dateRaw') or ''), str(it.get('time') or '')),
            reverse=True,
        )
    except Exception:
        pass

    summary = {
        'present': sum(1 for r in records if r.get('status') == 'present'),
        'late': sum(1 for r in records if r.get('status') == 'late'),
        'absent': sum(1 for r in records if r.get('status') == 'absent'),
        'total': len(records),
    }

    return _response(200, {
        'ok': True,
        'studentEmail': student_email,
        'records': records,
        'summary': summary,
    })

