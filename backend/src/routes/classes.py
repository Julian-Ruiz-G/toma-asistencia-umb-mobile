from runtime import *  # noqa: F401,F403

def handle_create_class(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    class_name = (body.get('className') or body.get('nombreClase') or '').strip()
    group = (body.get('group') or body.get('grupo') or '').strip()
    start_time = (body.get('startTime') or body.get('horaInicio') or '').strip()
    end_time = (body.get('endTime') or body.get('horaFin') or '').strip()
    subject_code = (body.get('subjectCode') or body.get('codigoAsignatura') or '').strip()
    period = (body.get('period') or body.get('periodo') or '').strip()
    schedule = _parse_schedule_list((body.get('schedule') if isinstance(body, dict) else None) or [])

    if schedule and (not start_time or not end_time):
        st2, et2 = _derive_start_end_from_schedule(schedule)
        start_time = start_time or st2
        end_time = end_time or et2

    if not class_name or not group or not start_time or not end_time:
        return _response(400, {'error': 'Missing fields: className, group, startTime, endTime'})

    teacher_email = str(payload.get('sub') or '').strip().lower()
    class_id = uuid.uuid4().hex
    pk = f"CLASS#{class_id}"
    now = int(time.time())
    item = {
        'RekognitionId': {'S': pk},
        'Type': {'S': 'Class'},
        'ClassId': {'S': class_id},
        'ClassName': {'S': class_name},
        'Group': {'S': group},
        'StartTime': {'S': start_time},
        'EndTime': {'S': end_time},
        'TeacherEmail': {'S': teacher_email},
        'CreatedAt': {'N': str(now)},
    }

    if subject_code:
        item['SubjectCode'] = {'S': subject_code}
    if period:
        item['Period'] = {'S': period}
    if schedule:
        item['Schedule'] = {
            'L': [
                {
                    'M': {
                        'Day': {'S': str(s.get('day') or '')},
                        'StartTime': {'S': str(s.get('startTime') or '')},
                        'EndTime': {'S': str(s.get('endTime') or '')},
                    }
                }
                for s in schedule
                if (s.get('day') and s.get('startTime') and s.get('endTime'))
            ]
        }

    try:
        dynamodb.put_item(TableName=DDB_TABLE, Item=item)
    except Exception as e:
        logger.exception('DynamoDB put_item failed (create-class)')
        return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})

    class_token = None
    try:
        class_token = _sign_token({
            'classId': class_id,
            'teacherEmail': teacher_email,
            'role': 'class',
            'iat': now,
            'exp': now + 60 * 60 * 8,
        })
    except Exception:
        class_token = None

    return _response(200, {
        'ok': True,
        'classId': class_id,
        'classToken': class_token,
        'className': class_name,
        'group': group,
        'startTime': start_time,
        'endTime': end_time,
        'teacherEmail': teacher_email,
        'subjectCode': subject_code,
        'period': period,
        'schedule': schedule,
    })

def handle_update_class(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    teacher_email = str(payload.get('sub') or '').strip().lower()
    class_id = (body.get('classId') or '').strip()
    class_name = (body.get('className') or body.get('nombreClase') or '').strip()
    group = (body.get('group') or body.get('grupo') or '').strip()
    start_time = (body.get('startTime') or body.get('horaInicio') or '').strip()
    end_time = (body.get('endTime') or body.get('horaFin') or '').strip()
    subject_code = (body.get('subjectCode') or body.get('codigoAsignatura') or '').strip()
    period = (body.get('period') or body.get('periodo') or '').strip()
    schedule = _parse_schedule_list((body.get('schedule') if isinstance(body, dict) else None) or [])

    # Verificar que la clase exista y pertenezca al profesor
    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (update-class)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound', 'message': 'Clase no encontrada'})

    class_teacher = _ddb_s(class_item, 'TeacherEmail')
    if class_teacher and class_teacher.strip().lower() != teacher_email:
        return _response(403, {'error': 'Forbidden', 'message': 'No puedes modificar esta clase'})

    # Actualizar datos de la clase
    update_expression = 'SET '
    expression_values = {}
    expression_names = {}

    if class_name:
        update_expression += '#CN = :cn, '
        expression_names['#CN'] = 'ClassName'
        expression_values[':cn'] = {'S': class_name}

    if group:
        update_expression += '#G = :g, '
        expression_names['#G'] = 'Group'
        expression_values[':g'] = {'S': group}

    if start_time:
        update_expression += '#ST = :st, '
        expression_names['#ST'] = 'StartTime'
        expression_values[':st'] = {'S': start_time}

    if end_time:
        update_expression += '#ET = :et, '
        expression_names['#ET'] = 'EndTime'
        expression_values[':et'] = {'S': end_time}

    if subject_code:
        update_expression += '#SC = :sc, '
        expression_names['#SC'] = 'SubjectCode'
        expression_values[':sc'] = {'S': subject_code}

    if period:
        update_expression += '#P = :p, '
        expression_names['#P'] = 'Period'
        expression_values[':p'] = {'S': period}

    if schedule:
        update_expression += '#SCH = :sch, '
        expression_names['#SCH'] = 'Schedule'
        expression_values[':sch'] = {
            'L': [
                {
                    'M': {
                        'Day': {'S': str(s.get('day') or '')},
                        'StartTime': {'S': str(s.get('startTime') or '')},
                        'EndTime': {'S': str(s.get('endTime') or '')},
                    }
                }
                for s in schedule
                if (s.get('day') and s.get('startTime') and s.get('endTime'))
            ]
        }

    # Remover la última coma y espacio
    update_expression = update_expression.rstrip(', ')

    if update_expression == 'SET':
        return _response(400, {'error': 'NoFieldsToUpdate', 'message': 'No se especificaron campos para actualizar'})

    try:
        dynamodb.update_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values
        )
        logger.info(f'Class {class_id} updated successfully by teacher {teacher_email}')
        return _response(200, {'ok': True, 'message': 'Clase actualizada exitosamente'})
    except Exception as e:
        logger.exception(f'Error updating class {class_id}: {str(e)}')
        return _response(500, {'error': 'UpdateFailed', 'message': 'Error al actualizar la clase'})

def handle_create_class_duplicate(event, body):
        token = _get_bearer_token(event)
        payload = _verify_token(token)
        if not payload or payload.get('role') != 'teacher':
            return _response(401, {'error': 'Unauthorized'})

        class_name = (body.get('className') or body.get('nombreClase') or '').strip()
        group = (body.get('group') or body.get('grupo') or '').strip()
        start_time = (body.get('startTime') or body.get('horaInicio') or '').strip()
        end_time = (body.get('endTime') or body.get('horaFin') or '').strip()
        subject_code = (body.get('subjectCode') or body.get('codigoAsignatura') or '').strip()
        period = (body.get('period') or body.get('periodo') or '').strip()
        schedule = _parse_schedule_list((body.get('schedule') if isinstance(body, dict) else None) or [])

        if schedule and (not start_time or not end_time):
            st2, et2 = _derive_start_end_from_schedule(schedule)
            start_time = start_time or st2
            end_time = end_time or et2

        if not class_name or not group or not start_time or not end_time:
            return _response(400, {'error': 'Missing fields: className, group, startTime, endTime'})

        teacher_email = str(payload.get('sub') or '').strip().lower()
        class_id = uuid.uuid4().hex
        pk = f"CLASS#{class_id}"
        now = int(time.time())
        item = {
            'RekognitionId': {'S': pk},
            'Type': {'S': 'Class'},
            'ClassId': {'S': class_id},
            'ClassName': {'S': class_name},
            'Group': {'S': group},
            'StartTime': {'S': start_time},
            'EndTime': {'S': end_time},
            'TeacherEmail': {'S': teacher_email},
            'CreatedAt': {'N': str(now)},
        }

        if subject_code:
            item['SubjectCode'] = {'S': subject_code}
        if period:
            item['Period'] = {'S': period}
        if schedule:
            item['Schedule'] = {
                'L': [
                    {
                        'M': {
                            'Day': {'S': str(s.get('day') or '')},
                            'StartTime': {'S': str(s.get('startTime') or '')},
                            'EndTime': {'S': str(s.get('endTime') or '')},
                        }
                    }
                    for s in schedule
                    if (s.get('day') and s.get('startTime') and s.get('endTime'))
                ]
            }

        try:
            dynamodb.put_item(TableName=DDB_TABLE, Item=item)
            logger.info(f'Class {class_id} created successfully by teacher {teacher_email}')
        except Exception as e:
            logger.exception('DynamoDB put_item failed (create-class)')
            return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})

        class_token = None
        try:
            class_token = _sign_token({
                'classId': class_id,
                'teacherEmail': teacher_email,
                'role': 'class',
                'iat': now,
                'exp': now + 60 * 60 * 8,
            })
        except Exception:
            class_token = None

        return _response(200, {
            'ok': True,
            'classId': class_id,
            'classToken': class_token,
            'className': class_name,
            'group': group,
            'startTime': start_time,
            'endTime': end_time,
            'teacherEmail': teacher_email,
            'subjectCode': subject_code,
            'period': period,
            'schedule': schedule,
        })

def handle_join_class(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'student':
        return _response(401, {'error': 'Unauthorized'})

    class_token = (body.get('classToken') or body.get('qr') or '').strip()
    if not class_token:
        return _response(400, {'error': 'Missing field: classToken'})

    class_payload = _verify_token(class_token)
    if not class_payload or class_payload.get('role') != 'class':
        return _response(400, {'error': 'InvalidClassToken'})

    class_id = str(class_payload.get('classId') or '').strip()
    teacher_email = str(class_payload.get('teacherEmail') or '').strip().lower()
    if not class_id or not teacher_email:
        return _response(400, {'error': 'InvalidClassToken'})

    student_email = str(payload.get('sub') or '').strip().lower()
    now = int(time.time())

    provided_name = (body.get('studentName') or body.get('fullName') or '').strip()
    provided_code = (body.get('studentCode') or '').strip()

    # Fetch student profile (optional)
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
            if not student_name:
                student_name = _ddb_s(it, 'FullName') or None
            if not student_code:
                student_code = _ddb_s(it, 'StudentCode') or None
    except Exception:
        student_name = student_name
        student_code = student_code

    enroll_pk = f"ENROLL#{class_id}#{student_email}"
    enroll_item = {
        'RekognitionId': {'S': enroll_pk},
        'Type': {'S': 'Enrollment'},
        'ClassId': {'S': class_id},
        'TeacherEmail': {'S': teacher_email},
        'StudentEmail': {'S': student_email},
        'JoinedAt': {'N': str(now)},
    }
    if student_name:
        enroll_item['StudentName'] = {'S': student_name}
    if student_code:
        enroll_item['StudentCode'] = {'S': student_code}

    try:
        dynamodb.put_item(TableName=DDB_TABLE, Item=enroll_item)
    except Exception as e:
        logger.exception('DynamoDB put_item failed (join-class)')
        return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})

    class_item = None
    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception:
        class_item = None

    class_info = None
    if class_item:
        class_info = {
            'classId': _ddb_s(class_item, 'ClassId') or class_id,
            'className': _ddb_s(class_item, 'ClassName'),
            'group': _ddb_s(class_item, 'Group'),
            'startTime': _ddb_s(class_item, 'StartTime'),
            'endTime': _ddb_s(class_item, 'EndTime'),
            'teacherEmail': _ddb_s(class_item, 'TeacherEmail') or teacher_email,
            'subjectCode': _ddb_s(class_item, 'SubjectCode'),
            'period': _ddb_s(class_item, 'Period'),
            'schedule': _ddb_schedule(class_item, 'Schedule'),
        }

    return _response(200, {
        'ok': True,
        'classId': class_id,
        'className': (class_info or {}).get('className'),
        'group': (class_info or {}).get('group'),
        'startTime': (class_info or {}).get('startTime'),
        'endTime': (class_info or {}).get('endTime'),
        'schedule': (class_info or {}).get('schedule'),
        'teacherEmail': teacher_email,
        'studentEmail': student_email,
        'studentName': student_name,
        'studentCode': student_code,
        'class': class_info,
        'options': {
            'qr': True,
            'photo': True,
        },
    })

def handle_my_classes(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') not in ('teacher', 'student'):
        return _response(401, {'error': 'Unauthorized'})

    role = str(payload.get('role') or '')
    email = str(payload.get('sub') or '').strip().lower()
    if not email:
        return _response(401, {'error': 'Unauthorized'})

    classes = []

    if role == 'teacher':
        enroll_counts = {}
        try:
            enroll_scan = dynamodb.scan(
                TableName=DDB_TABLE,
                FilterExpression='#T = :t AND #TE = :e',
                ExpressionAttributeNames={'#T': 'Type', '#TE': 'TeacherEmail'},
                ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':e': {'S': email}},
                Limit=1000,
            )
            enroll_items = (enroll_scan or {}).get('Items') or []
            for en in enroll_items:
                cid = _ddb_s(en, 'ClassId')
                if not cid:
                    continue
                enroll_counts[cid] = int(enroll_counts.get(cid, 0)) + 1
        except Exception:
            enroll_counts = {}

        try:
            scan_resp = dynamodb.scan(
                TableName=DDB_TABLE,
                FilterExpression='#T = :t AND #TE = :e',
                ExpressionAttributeNames={'#T': 'Type', '#TE': 'TeacherEmail'},
                ExpressionAttributeValues={':t': {'S': 'Class'}, ':e': {'S': email}},
                Limit=200,
            )
        except Exception as e:
            logger.exception('DynamoDB scan failed (my-classes teacher)')
            return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

        for it in (scan_resp or {}).get('Items') or []:
            class_id = _ddb_s(it, 'ClassId')
            classes.append({
                'classId': class_id,
                'className': _ddb_s(it, 'ClassName'),
                'group': _ddb_s(it, 'Group'),
                'startTime': _ddb_s(it, 'StartTime'),
                'endTime': _ddb_s(it, 'EndTime'),
                'teacherEmail': _ddb_s(it, 'TeacherEmail'),
                'schedule': _ddb_schedule(it, 'Schedule'),
                'studentsCount': int(enroll_counts.get(class_id, 0)),
            })

    if role == 'student':
        try:
            scan_resp = dynamodb.scan(
                TableName=DDB_TABLE,
                FilterExpression='#T = :t AND #SE = :e',
                ExpressionAttributeNames={'#T': 'Type', '#SE': 'StudentEmail'},
                ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':e': {'S': email}},
                Limit=200,
            )
        except Exception as e:
            logger.exception('DynamoDB scan failed (my-classes student)')
            return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

        enrolls = (scan_resp or {}).get('Items') or []
        for en in enrolls:
            cid = _ddb_s(en, 'ClassId')
            if not cid:
                continue
            try:
                class_resp = dynamodb.get_item(
                    TableName=DDB_TABLE,
                    Key={'RekognitionId': {'S': f"CLASS#{cid}"}}
                )
                it = (class_resp or {}).get('Item')
            except Exception:
                it = None

            if it:
                classes.append({
                    'classId': cid,
                    'className': _ddb_s(it, 'ClassName'),
                    'group': _ddb_s(it, 'Group'),
                    'startTime': _ddb_s(it, 'StartTime'),
                    'endTime': _ddb_s(it, 'EndTime'),
                    'teacherEmail': _ddb_s(it, 'TeacherEmail'),
                    'schedule': _ddb_schedule(it, 'Schedule'),
                })
            else:
                classes.append({
                    'classId': cid,
                    'className': None,
                    'group': None,
                    'startTime': None,
                    'endTime': None,
                    'teacherEmail': _ddb_s(en, 'TeacherEmail'),
                    'schedule': [],
                })

    return _response(200, {
        'ok': True,
        'role': role,
        'email': email,
        'classes': classes,
    })

def handle_class_details(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') not in ('teacher', 'student'):
        return _response(401, {'error': 'Unauthorized'})

    role = str(payload.get('role') or '')
    email = str(payload.get('sub') or '').strip().lower()
    class_id = (body.get('classId') or '').strip()
    if not class_id:
        return _response(400, {'error': 'Missing field: classId'})

    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (class-details)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    teacher_email = _ddb_s(class_item, 'TeacherEmail')

    if role == 'teacher' and teacher_email and teacher_email != email:
        return _response(403, {'error': 'Forbidden'})

    try:
        scan_resp = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #CID = :cid',
            ExpressionAttributeNames={'#T': 'Type', '#CID': 'ClassId'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':cid': {'S': class_id}},
            Limit=300,
        )
    except Exception as e:
        logger.exception('DynamoDB scan failed (class-details enrollments)')
        return _response(500, {'error': 'DynamoDBScanFailed', 'details': str(e)})

    enroll_items = (scan_resp or {}).get('Items') or []

    # Buscar sesión activa del día para esta clase
    attendance_session = None
    try:
        today = time.strftime('%Y-%m-%d', time.gmtime(time.time() + CO_TZ_OFFSET_SECONDS))
        session_scan_resp = dynamodb.scan(
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
                ':sd': {'S': today}
            },
            Limit=1,
        )
        session_items = (session_scan_resp or {}).get('Items') or []
        if session_items:
            session_item = session_items[0]
            attendance_session = {
                'sessionId': _ddb_s(session_item, 'SessionId'),
                'classId': _ddb_s(session_item, 'ClassId'),
                'sessionDate': _ddb_s(session_item, 'SessionDate'),
                'scheduledStartEpoch': _ddb_n(session_item, 'ScheduledStartEpoch'),
                'lateAfterSeconds': _ddb_n(session_item, 'LateAfterSeconds'),
                'createdAt': _ddb_s(session_item, 'CreatedAt'),
            }
    except Exception as e:
        logger.exception('DynamoDB scan failed (class-details attendance session)')

    # Todas las sesiones de asistencia de la clase (solo docente): más recientes primero
    attendance_sessions_full = []
    if role == 'teacher':
        try:
            last_key_sessions = None
            for _page in range(0, 40):
                scan_sess_kwargs = {
                    'TableName': DDB_TABLE,
                    'FilterExpression': '#T = :t AND #CID = :cid',
                    'ExpressionAttributeNames': {'#T': 'Type', '#CID': 'ClassId'},
                    'ExpressionAttributeValues': {
                        ':t': {'S': 'AttendanceSession'},
                        ':cid': {'S': class_id},
                    },
                    'Limit': 100,
                }
                if last_key_sessions:
                    scan_sess_kwargs['ExclusiveStartKey'] = last_key_sessions
                sess_resp = dynamodb.scan(**scan_sess_kwargs)
                seen_ids = {row.get('sessionId') for row in attendance_sessions_full}
                for it in (sess_resp or {}).get('Items') or []:
                    sid = (_ddb_s(it, 'SessionId') or '').strip()
                    if not sid or sid in seen_ids:
                        continue
                    seen_ids.add(sid)
                    attendance_sessions_full.append({
                        'sessionId': sid,
                        'classId': _ddb_s(it, 'ClassId'),
                        'sessionDate': _ddb_s(it, 'SessionDate'),
                        'scheduledStartEpoch': _ddb_n(it, 'ScheduledStartEpoch'),
                        'lateAfterSeconds': _ddb_n(it, 'LateAfterSeconds'),
                        'corte': _ddb_s(it, 'Corte') or None,
                    })
                last_key_sessions = (sess_resp or {}).get('LastEvaluatedKey')
                if not last_key_sessions:
                    break

            def _session_sort_key(row):
                sd = str(row.get('sessionDate') or '0000-00-00')
                try:
                    se = int(str(row.get('scheduledStartEpoch') or '0') or '0')
                except Exception:
                    se = 0
                sid = str(row.get('sessionId') or '')
                return (sd, se, sid)

            attendance_sessions_full.sort(key=_session_sort_key, reverse=True)
        except Exception:
            logger.exception('DynamoDB scan failed (class-details attendanceSessions list)')
            attendance_sessions_full = []

    if role == 'student':
        enrolled = False
        expected_pk = f"ENROLL#{class_id}#{email}".lower()
        for en in enroll_items:
            pk = _ddb_s(en, 'RekognitionId').strip().lower()
            se = (_ddb_s(en, 'StudentEmail') or '').strip().lower()
            if pk and pk == expected_pk:
                enrolled = True
                break
            if se and se == email:
                enrolled = True
                break
        if not enrolled:
            return _response(403, {'error': 'NotEnrolled'})

    student_profile_by_email = {}
    try:
        needs_profiles = False
        for en in enroll_items:
            if not _ddb_s(en, 'StudentName') or not _ddb_s(en, 'StudentCode'):
                needs_profiles = True
                break
        if needs_profiles:
            scan_students = dynamodb.scan(
                TableName=DDB_TABLE,
                FilterExpression='#R = :r',
                ExpressionAttributeNames={'#R': 'Role'},
                ExpressionAttributeValues={':r': {'S': 'student'}},
                Limit=500,
            )
            for it in (scan_students or {}).get('Items') or []:
                e = (_ddb_s(it, 'Email') or '').strip().lower()
                if not e:
                    continue
                student_profile_by_email[e] = {
                    'studentName': _ddb_s(it, 'FullName') or None,
                    'studentCode': _ddb_s(it, 'StudentCode') or None,
                }
    except Exception:
        student_profile_by_email = {}

    students = []
    seen_emails = set()
    for en in enroll_items:
        se = (_ddb_s(en, 'StudentEmail') or '').strip().lower()
        if not se:
            continue
        if se in seen_emails:
            continue
        seen_emails.add(se)

        name = _ddb_s(en, 'StudentName') or None
        code = _ddb_s(en, 'StudentCode') or None
        if (not name or not code) and student_profile_by_email.get(se):
            prof = student_profile_by_email.get(se) or {}
            name = name or prof.get('studentName')
            code = code or prof.get('studentCode')

        students.append({
            'studentEmail': se,
            'studentName': name,
            'studentCode': code,
            'joinedAt': (en.get('JoinedAt', {}) or {}).get('N') or None,
        })

    response_data = {
        'ok': True,
        'class': {
            'classId': class_id,
            'className': _ddb_s(class_item, 'ClassName'),
            'group': _ddb_s(class_item, 'Group'),
            'startTime': _ddb_s(class_item, 'StartTime'),
            'endTime': _ddb_s(class_item, 'EndTime'),
            'teacherEmail': teacher_email,
            'subjectCode': _ddb_s(class_item, 'SubjectCode'),
            'period': _ddb_s(class_item, 'Period'),
            'schedule': _ddb_schedule(class_item, 'Schedule'),
        },
        'students': students,
    }

    # Agregar sesión activa si existe
    if attendance_session:
        response_data['attendanceSession'] = attendance_session

    if role == 'teacher':
        response_data['attendanceSessions'] = attendance_sessions_full

    return _response(200, response_data)

def handle_regenerate_class_qr(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    email = str(payload.get('sub') or '').strip().lower()
    class_id = (body.get('classId') or '').strip()
    if not class_id:
        return _response(400, {'error': 'Missing field: classId'})

    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (regenerate-class-qr)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    teacher_email = _ddb_s(class_item, 'TeacherEmail')
    if teacher_email and teacher_email != email:
        return _response(403, {'error': 'Forbidden'})

    now = int(time.time())
    class_token = None
    try:
        class_token = _sign_token({
            'classId': class_id,
            'teacherEmail': teacher_email or email,
            'role': 'class',
            'iat': now,
            'exp': now + 60 * 60 * 8,
        })
    except Exception:
        class_token = None

    return _response(200, {
        'ok': True,
        'classId': class_id,
        'classToken': class_token,
    })

def handle_remove_student_from_class(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    teacher = str(payload.get('sub') or '').strip().lower()
    class_id = (body.get('classId') or '').strip()
    student_email_in = (body.get('studentEmail') or '').strip().lower()
    if not class_id or not student_email_in:
        return _response(400, {'error': 'Missing fields: classId, studentEmail'})

    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (remove-student-from-class)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    class_teacher = _ddb_s(class_item, 'TeacherEmail').strip().lower()
    if class_teacher and class_teacher != teacher:
        return _response(403, {'error': 'Forbidden'})

    key_to_delete = f"ENROLL#{class_id}#{student_email_in}".lower()
    deleted = False

    try:
        deleted = _try_ddb_delete_enrollment_by_pk(key_to_delete)
    except Exception:
        deleted = False

    if not deleted:
        try:
            scan_resp = dynamodb.scan(
                TableName=DDB_TABLE,
                FilterExpression='#T = :t AND #CID = :cid',
                ExpressionAttributeNames={'#T': 'Type', '#CID': 'ClassId'},
                ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':cid': {'S': class_id}},
                Limit=300,
            )
            for en in (scan_resp or {}).get('Items') or []:
                se = (_ddb_s(en, 'StudentEmail') or '').strip().lower()
                if se and se == student_email_in:
                    pk = _ddb_s(en, 'RekognitionId')
                    if pk:
                        try:
                            if _try_ddb_delete_enrollment_by_pk(pk):
                                deleted = True
                                break
                        except Exception:
                            try:
                                dynamodb.delete_item(
                                    TableName=DDB_TABLE,
                                    Key={'RekognitionId': {'S': pk}}
                                )
                                deleted = True
                                break
                            except Exception:
                                deleted = False
        except Exception as e:
            logger.exception('DynamoDB delete/scan failed (remove-student-from-class)')
            return _response(500, {'error': 'DynamoDBDeleteFailed', 'details': str(e)})

    if not deleted:
        return _response(404, {'error': 'EnrollmentNotFound'})

    return _response(200, {
        'ok': True,
        'classId': class_id,
        'studentEmail': student_email_in,
    })

def handle_delete_class(event, body):
    logger.info('DELETE-CLASS: Request received')

    token = _get_bearer_token(event)
    payload = _verify_token(token)

    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    teacher = str(payload.get('sub') or '').strip().lower()
    class_id = (body.get('classId') or '').strip()

    if not class_id:
        return _response(400, {'error': 'Missing field: classId'})

    # ==========================================
    # Buscar clase
    # ==========================================

    class_pk = f"CLASS#{class_id}"

    try:
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={
                'RekognitionId': {'S': class_pk}
            }
        )

        class_item = class_resp.get('Item')

    except Exception as e:
        logger.exception('Error getting class')
        return _response(500, {
            'error': 'DynamoDBGetFailed',
            'details': str(e)
        })

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    class_teacher = _ddb_s(class_item, 'Email')

    if class_teacher:
        class_teacher = class_teacher.strip().lower()

    if class_teacher and class_teacher != teacher:
        return _response(403, {'error': 'Forbidden'})

    deleted_items = []
    errors = []

    # ==========================================
    # ELIMINAR ENROLLMENTS
    # ==========================================

    try:
        enroll_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='ClassId = :cid AND begins_with(RekognitionId, :prefix)',
            ExpressionAttributeValues={
                ':cid': {'S': class_id},
                ':prefix': {'S': 'ENROLL#'}
            }
        )

        for item in enroll_scan.get('Items', []):
            pk = _ddb_s(item, 'RekognitionId')

            dynamodb.delete_item(
                TableName=DDB_TABLE,
                Key={
                    'RekognitionId': {'S': pk}
                }
            )

            deleted_items.append(pk)

    except Exception as e:
        logger.exception('Error deleting enrollments')
        errors.append(str(e))

    # ==========================================
    # ELIMINAR ATTSESSIONS
    # ==========================================

    try:
        session_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='ClassId = :cid AND begins_with(RekognitionId, :prefix)',
            ExpressionAttributeValues={
                ':cid': {'S': class_id},
                ':prefix': {'S': 'ATTSESSION#'}
            }
        )

        sessions = session_scan.get('Items', [])

        for item in sessions:

            session_pk = _ddb_s(item, 'RekognitionId')
            session_id = _ddb_s(item, 'SessionId')

            # =========================
            # BORRAR ATTENDANCE
            # =========================

            try:
                attendance_scan = dynamodb.scan(
                    TableName=DDB_TABLE,
                    FilterExpression='SessionId = :sid',
                    ExpressionAttributeValues={
                        ':sid': {'S': session_id}
                    }
                )

                for att in attendance_scan.get('Items', []):

                    att_pk = _ddb_s(att, 'RekognitionId')

                    dynamodb.delete_item(
                        TableName=DDB_TABLE,
                        Key={
                            'RekognitionId': {'S': att_pk}
                        }
                    )

                    deleted_items.append(att_pk)

            except Exception as e:
                errors.append(f'Attendance delete error: {str(e)}')

            # =========================
            # BORRAR SESSION
            # =========================

            dynamodb.delete_item(
                TableName=DDB_TABLE,
                Key={
                    'RekognitionId': {'S': session_pk}
                }
            )

            deleted_items.append(session_pk)

    except Exception as e:
        logger.exception('Error deleting sessions')
        errors.append(str(e))

    # ==========================================
    # BORRAR CLASE
    # ==========================================

    try:
        dynamodb.delete_item(
            TableName=DDB_TABLE,
            Key={
                'RekognitionId': {'S': class_pk}
            }
        )

        deleted_items.append(class_pk)

    except Exception as e:
        logger.exception('Error deleting class')
        errors.append(str(e))

    # ==========================================
    # RESPUESTA
    # ==========================================

    if errors:
        return _response(500, {
            'error': 'PartialDeleteFailure',
            'errors': errors,
            'deletedItems': deleted_items
        })

    return _response(200, {
        'ok': True,
        'message': 'Class deleted successfully',
        'classId': class_id,
        'deletedItems': deleted_items
    })

