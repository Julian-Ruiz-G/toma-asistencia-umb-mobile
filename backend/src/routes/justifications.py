from runtime import *  # noqa: F401,F403

JUSTIFICATION_DAYS = 7
MAX_JUSTIFICATION_BYTES = 4 * 1024 * 1024


def justification_deadline_epoch(session_date: str = '', marked_at=None) -> int:
    ymd = str(session_date or '').strip()
    match = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', ymd)
    if match:
        try:
            end = datetime.datetime(
                int(match.group(1)),
                int(match.group(2)),
                int(match.group(3)),
                23,
                59,
                59,
                tzinfo=CO_TZ,
            )
            return int(end.timestamp()) + JUSTIFICATION_DAYS * 24 * 3600
        except Exception:
            pass
    if str(marked_at or '').isdigit():
        return int(marked_at) + JUSTIFICATION_DAYS * 24 * 3600
    return 0


def _justification_pk(session_id: str, student_email: str) -> str:
    return f'JUSTIF#{session_id}#{student_email}'.lower()


def _justification_view(item: dict) -> dict:
    created = _ddb_n(item, 'CreatedAt')
    deadline = _ddb_n(item, 'DeadlineEpoch')
    return {
        'id': _ddb_s(item, 'RekognitionId'),
        'sessionId': _ddb_s(item, 'SessionId'),
        'classId': _ddb_s(item, 'ClassId'),
        'className': _ddb_s(item, 'ClassName'),
        'studentEmail': _ddb_s(item, 'StudentEmail'),
        'studentName': _ddb_s(item, 'StudentName'),
        'teacherEmail': _ddb_s(item, 'TeacherEmail'),
        'status': _ddb_s(item, 'Status') or 'enviada',
        'reason': _ddb_s(item, 'Reason'),
        'reviewNote': _ddb_s(item, 'ReviewNote'),
        'fileKey': _ddb_s(item, 'FileKey'),
        'hasFile': bool(_ddb_s(item, 'FileKey')),
        'sessionDate': _ddb_s(item, 'SessionDate'),
        'createdAt': int(created) if str(created).isdigit() else None,
        'deadlineEpoch': int(deadline) if str(deadline).isdigit() else None,
    }


def _load_justification_map(student_email: str) -> dict:
    items = _ddb_scan_all(
        '#T = :t AND #SE = :se',
        {'#T': 'Type', '#SE': 'StudentEmail'},
        {':t': {'S': 'Justification'}, ':se': {'S': student_email}},
    )
    out = {}
    for it in items:
        sid = _ddb_s(it, 'SessionId')
        if sid:
            out[sid] = it
    return out


def enrich_history_records(records: list, student_email: str) -> list:
    now = int(time.time())
    try:
        by_session = _load_justification_map(student_email)
    except Exception:
        logger.exception('justification enrich failed')
        by_session = {}
    for row in records:
        sid = str(row.get('sessionId') or '')
        item = by_session.get(sid)
        status = _ddb_s(item, 'Status') if item else ''
        deadline = justification_deadline_epoch(row.get('dateRaw') or '', row.get('markedAt'))
        if item and status == 'enviada' and deadline and now > deadline:
            status = 'vencida'
        row['justificationStatus'] = status or None
        row['justificationId'] = _ddb_s(item, 'RekognitionId') if item else None
        row['justifyUntil'] = deadline or None
        raw = str(row.get('statusRaw') or '')
        row['canJustify'] = bool(
            raw == 'inasistencia'
            and status not in ('enviada', 'aprobada')
            and deadline
            and now <= deadline
        )
    return records


def _expire_if_needed(item: dict, now: int) -> str:
    status = _ddb_s(item, 'Status') or 'enviada'
    deadline = int(_ddb_n(item, 'DeadlineEpoch') or '0')
    if status == 'enviada' and deadline and now > deadline:
        try:
            dynamodb.update_item(
                TableName=DDB_TABLE,
                Key={'RekognitionId': {'S': _ddb_s(item, 'RekognitionId')}},
                UpdateExpression='SET #S = :s',
                ExpressionAttributeNames={'#S': 'Status'},
                ExpressionAttributeValues={':s': {'S': 'vencida'}},
            )
        except Exception:
            logger.exception('justification expire failed')
        return 'vencida'
    return status


def handle_submit_justification(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'student':
        return _response(401, {'error': 'Unauthorized'})

    student_email = str(payload.get('sub') or '').strip().lower()
    session_id = (body.get('sessionId') or '').strip() if isinstance(body, dict) else ''
    reason = ' '.join(str((body.get('reason') or body.get('motivo') or '') if isinstance(body, dict) else '').split())
    if not session_id or len(reason) < 10:
        return _response(400, {
            'error': 'Missing fields: sessionId, reason',
            'message': 'Indica la sesión y escribe el motivo, con al menos 10 caracteres.',
        })
    if len(reason) > 500:
        reason = reason[:500]

    try:
        session_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f'ATTSESSION#{session_id}'}},
        )
        session_item = (session_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (submit-justification session)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})
    if not session_item:
        return _response(404, {'error': 'SessionNotFound', 'message': 'No encontramos esa sesión.'})

    class_id = (_ddb_s(session_item, 'ClassId') or '').strip()
    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f'CLASS#{class_id}'}},
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (submit-justification class)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})
    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    teacher_email = (_ddb_s(class_item, 'TeacherEmail') or _ddb_s(session_item, 'TeacherEmail') or '').strip().lower()
    class_name = _ddb_s(class_item, 'ClassName') or class_id
    session_date = _ddb_s(session_item, 'SessionDate')

    enrolled = False
    student_name = ''
    for pk in (f'ENROLL#{class_id}#{student_email}',):
        try:
            en_resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': pk}})
            en_item = (en_resp or {}).get('Item')
        except Exception:
            en_item = None
        if en_item and _ddb_s(en_item, 'Type') == 'Enrollment':
            enrolled = True
            student_name = _display_person_name(_ddb_s(en_item, 'StudentName'))
            break
    if not enrolled:
        return _response(403, {'error': 'NotEnrolled', 'message': 'No estás inscrito en esa clase.'})

    att_pk = f'ATTEND#{session_id}#{student_email}'.lower()
    try:
        att_resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': att_pk}})
        att_item = (att_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (submit-justification attendance)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if att_item:
        raw = (_ddb_s(att_item, 'Status') or '').strip().lower()
        if raw != 'inasistencia':
            return _response(400, {
                'error': 'NotAnAbsence',
                'message': 'Solo se puede justificar una inasistencia.',
            })
        marked_at = _ddb_n(att_item, 'MarkedAt')
    else:
        marked_at = ''

    now = int(time.time())
    deadline = justification_deadline_epoch(session_date, marked_at or now)
    if not deadline or now > deadline:
        return _response(400, {
            'error': 'JustificationExpired',
            'message': 'El plazo de 7 días para justificar esta falta ya venció.',
        })

    just_pk = _justification_pk(session_id, student_email)
    try:
        prev_resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': just_pk}})
        prev = (prev_resp or {}).get('Item')
    except Exception:
        prev = None
    prev_status = _expire_if_needed(prev, now) if prev else ''
    if prev_status in ('enviada', 'aprobada'):
        return _response(409, {
            'error': 'JustificationExists',
            'message': 'Esta falta ya tiene una justificación enviada o aprobada.',
        })

    file_key = ''
    image_b64 = body.get('imageBase64') if isinstance(body, dict) else None
    if image_b64:
        raw_bytes = _normalize_b64_image(str(image_b64))
        if not raw_bytes:
            return _response(400, {'error': 'InvalidFile', 'message': 'No se pudo leer el archivo adjunto.'})
        if len(raw_bytes) > MAX_JUSTIFICATION_BYTES:
            return _response(400, {'error': 'FileTooLarge', 'message': 'El archivo debe pesar menos de 4 MB.'})
        file_key = f'justifications/{class_id}/{session_id}/{student_email}/{uuid.uuid4().hex}.jpg'
        if not _put_private_object(file_key, raw_bytes, 'image/jpeg'):
            file_key = ''

    if not student_name:
        student_name = _display_person_name(body.get('studentName') if isinstance(body, dict) else '') or student_email

    item = {
        'RekognitionId': {'S': just_pk},
        'Type': {'S': 'Justification'},
        'SessionId': {'S': session_id},
        'ClassId': {'S': class_id},
        'ClassName': {'S': class_name},
        'StudentEmail': {'S': student_email},
        'StudentName': {'S': student_name},
        'TeacherEmail': {'S': teacher_email},
        'Status': {'S': 'enviada'},
        'Reason': {'S': reason},
        'SessionDate': {'S': session_date},
        'CreatedAt': {'N': str(now)},
        'DeadlineEpoch': {'N': str(deadline)},
    }
    if file_key:
        item['FileKey'] = {'S': file_key}
    try:
        dynamodb.put_item(TableName=DDB_TABLE, Item=item)
    except Exception as e:
        logger.exception('DynamoDB put_item failed (submit-justification)')
        return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})

    _audit_log(student_email, 'student', 'submit-justification', {
        'sessionId': session_id,
        'classId': class_id,
        'hasFile': bool(file_key),
    })
    if teacher_email:
        _upsert_student_notification(
            teacher_email,
            f'NOTIF#justif#{session_id}#{student_email}'.lower(),
            'Nueva justificación',
            f'{student_name} envió una justificación para {class_name}.',
            'info',
            now,
            extra={'ClassId': class_id, 'SessionId': session_id, 'ClassName': class_name, 'Action': 'justification'},
            keep_created=False,
        )

    return _response(200, {
        'ok': True,
        'status': 'enviada',
        'hasFile': bool(file_key),
        'justification': _justification_view(item),
    })


def handle_list_justifications(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    role = str((payload or {}).get('role') or '')
    if not payload or role not in ('student', 'teacher'):
        return _response(401, {'error': 'Unauthorized'})

    email = str(payload.get('sub') or '').strip().lower()
    class_id = (body.get('classId') or '').strip() if isinstance(body, dict) else ''
    now = int(time.time())
    if role == 'student':
        items = _ddb_scan_all(
            '#T = :t AND #SE = :se',
            {'#T': 'Type', '#SE': 'StudentEmail'},
            {':t': {'S': 'Justification'}, ':se': {'S': email}},
        )
    else:
        items = _ddb_scan_all(
            '#T = :t AND #TE = :te',
            {'#T': 'Type', '#TE': 'TeacherEmail'},
            {':t': {'S': 'Justification'}, ':te': {'S': email}},
        )

    rows = []
    for it in items:
        if class_id and _ddb_s(it, 'ClassId') != class_id:
            continue
        status = _expire_if_needed(it, now)
        view = _justification_view(it)
        view['status'] = status
        if role == 'teacher' and view.get('fileKey'):
            view['photoUrl'] = _presign_private_object(view['fileKey'])
        rows.append(view)
    rows.sort(key=lambda r: int(r.get('createdAt') or 0), reverse=True)
    return _response(200, {'ok': True, 'justifications': rows})


def handle_review_justification(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    teacher_email = str(payload.get('sub') or '').strip().lower()
    just_id = (body.get('justificationId') or body.get('id') or '').strip() if isinstance(body, dict) else ''
    decision = (body.get('decision') or '').strip().lower() if isinstance(body, dict) else ''
    note = ' '.join(str((body.get('note') or body.get('motivo') or '') if isinstance(body, dict) else '').split())
    if decision not in ('approve', 'reject', 'aprobada', 'rechazada'):
        return _response(400, {'error': 'InvalidDecision', 'message': 'Indica si apruebas o rechazas la justificación.'})
    approved = decision in ('approve', 'aprobada')
    if not approved and len(note) < 3:
        return _response(400, {'error': 'MissingNote', 'message': 'Escribe el motivo del rechazo.'})
    if not just_id:
        return _response(400, {'error': 'Missing field: justificationId'})

    try:
        resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': just_id}})
        item = (resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (review-justification)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})
    if not item or _ddb_s(item, 'Type') != 'Justification':
        return _response(404, {'error': 'JustificationNotFound', 'message': 'No encontramos esa justificación.'})

    owner = (_ddb_s(item, 'TeacherEmail') or '').strip().lower()
    if owner and owner != teacher_email:
        return _response(403, {'error': 'Forbidden'})

    now = int(time.time())
    status = _expire_if_needed(item, now)
    if status == 'vencida':
        return _response(400, {'error': 'JustificationExpired', 'message': 'El plazo para resolver esta justificación ya venció.'})
    if status != 'enviada':
        return _response(409, {'error': 'JustificationClosed', 'message': 'Esta justificación ya fue resuelta.'})

    new_status = 'aprobada' if approved else 'rechazada'
    try:
        dynamodb.update_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': just_id}},
            UpdateExpression='SET #S = :s, ReviewNote = :n, ReviewedAt = :t, ReviewedBy = :b',
            ExpressionAttributeNames={'#S': 'Status'},
            ExpressionAttributeValues={
                ':s': {'S': new_status},
                ':n': {'S': note[:300]},
                ':t': {'N': str(now)},
                ':b': {'S': teacher_email},
            },
        )
    except Exception as e:
        logger.exception('DynamoDB update_item failed (review-justification)')
        return _response(500, {'error': 'DynamoDBUpdateFailed', 'details': str(e)})

    student_email = (_ddb_s(item, 'StudentEmail') or '').strip().lower()
    session_id = _ddb_s(item, 'SessionId')
    class_id = _ddb_s(item, 'ClassId')
    class_name = _ddb_s(item, 'ClassName') or class_id
    student_name = _ddb_s(item, 'StudentName')
    if approved and student_email and session_id:
        att_pk = f'ATTEND#{session_id}#{student_email}'.lower()
        try:
            existing = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': att_pk}})
            att_item = (existing or {}).get('Item')
            if att_item:
                dynamodb.update_item(
                    TableName=DDB_TABLE,
                    Key={'RekognitionId': {'S': att_pk}},
                    UpdateExpression='SET #S = :s, #M = :m',
                    ExpressionAttributeNames={'#S': 'Status', '#M': 'Method'},
                    ExpressionAttributeValues={':s': {'S': 'asistencia'}, ':m': {'S': 'justification'}},
                )
            else:
                dynamodb.put_item(
                    TableName=DDB_TABLE,
                    Item={
                        'RekognitionId': {'S': att_pk},
                        'Type': {'S': 'Attendance'},
                        'SessionId': {'S': session_id},
                        'ClassId': {'S': class_id},
                        'TeacherEmail': {'S': teacher_email},
                        'StudentEmail': {'S': student_email},
                        'StudentName': {'S': student_name or student_email},
                        'MarkedAt': {'N': str(now)},
                        'Status': {'S': 'asistencia'},
                        'Method': {'S': 'justification'},
                    },
                )
        except Exception:
            logger.exception('attendance update failed (approve justification)')
        _sync_absence_warning(student_email, class_id, class_name, teacher_email, student_name, now)

    title = 'Justificación aprobada' if approved else 'Justificación rechazada'
    message = (
        f'Tu justificación de {class_name} fue aprobada. Quedaste presente en esa sesión.'
        if approved
        else f'Tu justificación de {class_name} fue rechazada. {note}'.strip()
    )
    if student_email:
        _upsert_student_notification(
            student_email,
            f'NOTIF#justifres#{session_id}#{student_email}'.lower(),
            title,
            message,
            'success' if approved else 'warning',
            now,
            extra={'ClassId': class_id, 'SessionId': session_id, 'ClassName': class_name, 'Action': 'justification'},
            keep_created=False,
        )

    _audit_log(teacher_email, 'teacher', 'review-justification', {
        'justificationId': just_id,
        'decision': new_status,
        'sessionId': session_id,
        'studentEmail': student_email,
    })
    return _response(200, {'ok': True, 'status': new_status})
