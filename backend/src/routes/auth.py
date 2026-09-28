from runtime import *  # noqa: F401,F403

def handle_register_teacher(event, body):
    provided = _get_header(event, 'x-admin-token')
    try:
        logger.info(
            f"admin_token_check configured={bool(ADMIN_TOKEN)} configured_len={len(ADMIN_TOKEN or '')} "
            f"provided_len={len(provided or '')} match={bool(ADMIN_TOKEN) and (provided == ADMIN_TOKEN)}"
        )
    except Exception:
        pass

    if not ADMIN_TOKEN or provided != ADMIN_TOKEN:
        return _response(403, {'error': 'Forbidden'})

    teacher_code = (body.get('teacherCode') or body.get('codigoDocente') or '').strip()
    full_name = (body.get('fullName') or body.get('nombreDocente') or '').strip()
    email = (body.get('email') or body.get('correo') or '').strip().lower()
    password = (body.get('password') or body.get('contrasena') or '').strip()

    if not full_name or not email or not password:
        return _response(400, {'error': 'Missing fields: fullName, email, password'})

    salt_hex = _new_salt_hex()
    pw_hash = _hash_password(password, salt_hex)

    # Reuse the same table: store teachers with a synthetic key in RekognitionId
    pk = f"USER#{email}"
    item = {
        'RekognitionId': {'S': pk},
        'FullName': {'S': full_name},
        'Email': {'S': email},
        'Role': {'S': 'teacher'},
        'PasswordSalt': {'S': salt_hex},
        'PasswordHash': {'S': pw_hash},
        'AcceptTerms': {'BOOL': False},
        'AcceptPrivacy': {'BOOL': False},
    }
    if teacher_code:
        item['TeacherCode'] = {'S': teacher_code}

    try:
        dynamodb.put_item(
            TableName=DDB_TABLE,
            Item=item
        )
    except Exception as e:
        logger.exception('DynamoDB put_item failed')
        return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})

    _audit_log(email, 'admin', 'register-teacher', {'teacherEmail': email})

    return _response(200, {
        'ok': True,
        'email': email,
        'fullName': full_name,
        'role': 'teacher'
    })

def handle_login_teacher(event, body):
    email = (body.get('email') or body.get('correo') or '').strip().lower()
    teacher_code = (body.get('teacherCode') or body.get('codigoDocente') or '').strip()
    password = (body.get('password') or body.get('contrasena') or '').strip()

    if not email or not password:
        return _response(400, {'error': 'Missing fields: email, password'})

    pk = f"USER#{email}"
    try:
        ddb_resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': pk}})
    except Exception as e:
        logger.exception('DynamoDB get_item failed')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    item = ddb_resp.get('Item') if isinstance(ddb_resp, dict) else None
    if not item:
        return _login_fail()

    role = (item.get('Role', {}) or {}).get('S')
    if role != 'teacher':
        return _login_fail()

    salt_hex = _ddb_s(item, 'PasswordSalt')
    stored_hash = _ddb_s(item, 'PasswordHash')
    if not salt_hex or not stored_hash:
        return _login_fail()

    computed = _hash_password(password, salt_hex)
    if computed != stored_hash:
        return _login_fail()

    stored_code = (item.get('TeacherCode', {}) or {}).get('S')
    if teacher_code and stored_code and teacher_code != stored_code:
        return _login_fail()

    now = int(time.time())
    token = None
    try:
        token = _sign_token({'sub': email, 'role': 'teacher', 'iat': now, 'exp': now + _login_ttl_seconds(body)})
    except Exception:
        token = None

    return _response(200, {
        'ok': True,
        'role': 'teacher',
        'email': (item.get('Email', {}) or {}).get('S') or email,
        'fullName': (item.get('FullName', {}) or {}).get('S'),
        'teacherCode': stored_code,
        'authToken': token,
        'acceptTerms': _ddb_bool(item, 'AcceptTerms') is True,
        'acceptPrivacy': _ddb_bool(item, 'AcceptPrivacy') is True,
        'mustChangePassword': _ddb_bool(item, 'MustChangePassword') is True,
    })

def handle_login_admin(event, body):
    email = (body.get('email') or body.get('correo') or '').strip().lower()
    password = (body.get('password') or body.get('contrasena') or '').strip()

    if not email or not password:
        return _response(400, {'error': 'Missing fields: email, password'})

    pk = f"USER#{email}"
    try:
        ddb_resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': pk}})
    except Exception as e:
        logger.exception('DynamoDB get_item failed (login-admin)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    item = ddb_resp.get('Item') if isinstance(ddb_resp, dict) else None
    if not item:
        return _login_fail()

    role = (item.get('Role', {}) or {}).get('S')
    if role != 'admin':
        return _login_fail()

    salt_hex = _ddb_s(item, 'PasswordSalt')
    stored_hash = _ddb_s(item, 'PasswordHash')
    if not salt_hex or not stored_hash:
        return _login_fail()

    computed = _hash_password(password, salt_hex)
    if computed != stored_hash:
        return _login_fail()

    now = int(time.time())
    token = None
    try:
        token = _sign_token({'sub': email, 'role': 'admin', 'iat': now, 'exp': now + _login_ttl_seconds(body)})
    except Exception:
        token = None

    return _response(200, {
        'ok': True,
        'role': 'admin',
        'email': (item.get('Email', {}) or {}).get('S') or email,
        'fullName': (item.get('FullName', {}) or {}).get('S'),
        'authToken': token,
        'mustChangePassword': _ddb_bool(item, 'MustChangePassword') is True,
    })

def handle_set_consent(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    role = str((payload or {}).get('role') or '')
    if not payload or role not in ('student', 'teacher'):
        return _response(401, {'error': 'Unauthorized'})

    user_email = str(payload.get('sub') or '').strip().lower()
    if not user_email:
        return _response(401, {'error': 'Unauthorized'})

    if role == 'teacher':
        item = _scan_find_user_by_email(user_email, roles=['teacher'], types=['Teacher'])
    else:
        item = _scan_find_student_by_email(user_email)
    if not item:
        return _response(404, {'error': 'UserNotFound'})

    pk = _ddb_s(item, 'RekognitionId')
    if not pk:
        return _response(500, {'error': 'UserKeyMissing'})

    now = int(time.time())
    names = {'#CU': 'ConsentUpdatedAt'}
    values = {':t': {'N': str(now)}}
    parts = ['#CU = :t']

    if isinstance(body, dict) and 'biometricConsent' in body:
        consent = bool(body.get('biometricConsent'))
        names['#BC'] = 'BiometricConsent'
        names['#CB'] = 'ConsentBiometric'
        names['#BCA'] = 'BiometricConsentUpdatedAt'
        values[':v'] = {'BOOL': consent}
        parts.extend(['#BC = :v', '#CB = :v', '#BCA = :t'])
    if isinstance(body, dict) and 'acceptTerms' in body:
        names['#AT'] = 'AcceptTerms'
        values[':at'] = {'BOOL': bool(body.get('acceptTerms'))}
        parts.append('#AT = :at')
    if isinstance(body, dict) and 'acceptPrivacy' in body:
        names['#AP'] = 'AcceptPrivacy'
        values[':ap'] = {'BOOL': bool(body.get('acceptPrivacy'))}
        parts.append('#AP = :ap')

    if len(parts) <= 1:
        return _response(400, {'error': 'Missing consent fields'})

    try:
        dynamodb.update_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': pk}},
            UpdateExpression='SET ' + ', '.join(parts),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
        )
    except Exception as e:
        logger.exception('DynamoDB update_item failed (set-consent)')
        return _response(500, {'error': 'DynamoDBUpdateFailed', 'details': str(e)})

    _audit_log(user_email, role, 'set-consent', {
        'biometricConsent': body.get('biometricConsent') if isinstance(body, dict) else None,
        'acceptTerms': body.get('acceptTerms') if isinstance(body, dict) else None,
        'acceptPrivacy': body.get('acceptPrivacy') if isinstance(body, dict) else None,
    })

    return _response(200, {'ok': True, 'updatedAt': now})

def handle_update_my_profile(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'student':
        return _response(401, {'error': 'Unauthorized'})

    student_email = str(payload.get('sub') or '').strip().lower()
    if not student_email:
        return _response(401, {'error': 'Unauthorized'})

    item = _scan_find_student_by_email(student_email)
    if not item:
        return _response(404, {'error': 'StudentNotFound'})

    pk = _ddb_s(item, 'RekognitionId')
    if not pk:
        return _response(500, {'error': 'StudentKeyMissing'})

    full_name = (body.get('fullName') or body.get('nombre') or '').strip() if isinstance(body, dict) else ''
    program = (body.get('program') or body.get('carrera') or '').strip() if isinstance(body, dict) else ''
    semester = (body.get('semester') or body.get('semestre') or '').strip() if isinstance(body, dict) else ''
    phone = (body.get('phone') or body.get('telefono') or '').strip() if isinstance(body, dict) else ''

    names = {}
    values = {}
    parts = []
    if full_name:
        names['#fn'] = 'FullName'
        values[':fn'] = {'S': full_name[:120]}
        parts.append('#fn = :fn')
    if program:
        names['#pg'] = 'Program'
        values[':pg'] = {'S': program[:80]}
        parts.append('#pg = :pg')
    if semester:
        names['#sm'] = 'Semester'
        values[':sm'] = {'S': semester[:20]}
        parts.append('#sm = :sm')
    if phone:
        names['#ph'] = 'Phone'
        values[':ph'] = {'S': phone[:30]}
        parts.append('#ph = :ph')

    if not parts:
        return _response(400, {'error': 'Missing fields: fullName, program, semester or phone'})

    try:
        dynamodb.update_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': pk}},
            UpdateExpression='SET ' + ', '.join(parts),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
        )
    except Exception as e:
        logger.exception('DynamoDB update_item failed (update-my-profile)')
        return _response(500, {'error': 'DynamoDBUpdateFailed', 'details': str(e)})

    _audit_log(student_email, 'student', 'update-my-profile', {
        'fullName': bool(full_name),
        'program': bool(program),
        'semester': bool(semester),
        'phone': bool(phone),
    })

    return _response(200, {
        'ok': True,
        'fullName': full_name or _ddb_s(item, 'FullName'),
        'program': program or _ddb_s(item, 'Program'),
        'semester': semester or _ddb_s(item, 'Semester'),
        'phone': phone or _ddb_s(item, 'Phone'),
    })

def handle_login_student(event, body):
    email = (body.get('email') or body.get('correo') or '').strip().lower()
    password = (body.get('password') or body.get('contrasena') or '').strip()
    student_code = (body.get('studentCode') or body.get('codigoEstudiante') or '').strip()

    if not email or not password:
        return _response(400, {'error': 'Missing fields: email, password'})

    item = _scan_find_student_by_email(email)
    if not item:
        return _login_fail()
    salt_hex = _ddb_s(item, 'PasswordSalt')
    stored_hash = _ddb_s(item, 'PasswordHash')
    if not salt_hex or not stored_hash:
        return _login_fail()

    computed = _hash_password(password, salt_hex)
    if computed != stored_hash:
        return _login_fail()

    stored_student_code = _ddb_s(item, 'StudentCode')
    if student_code and stored_student_code and student_code != stored_student_code:
        return _login_fail()

    now = int(time.time())
    token = None
    try:
        token = _sign_token({'sub': email, 'role': 'student', 'iat': now, 'exp': now + _login_ttl_seconds(body)})
    except Exception:
        token = None

    return _response(200, {
        'ok': True,
        'role': 'student',
        'email': _ddb_s(item, 'Email') or email,
        'fullName': _ddb_s(item, 'FullName'),
        'studentCode': stored_student_code,
        'program': _ddb_s(item, 'Program') or None,
        'semester': _ddb_s(item, 'Semester') or None,
        'phone': _ddb_s(item, 'Phone') or None,
        'authToken': token,
        'mustChangePassword': _ddb_bool(item, 'MustChangePassword') is True,
    })

def handle_captcha_challenge(event, body):
    challenge = _build_register_captcha()
    now = int(time.time())
    token = None
    if AUTH_SECRET:
        try:
            token = _sign_token({
                'role': 'captcha',
                'ans': str(challenge['answer']),
                'iat': now,
                'exp': now + 180,
                'nonce': secrets.token_hex(8),
            })
        except Exception:
            token = None
    return _response(200, {
        'ok': True,
        'prompt': challenge['prompt'],
        'options': challenge['options'],
        'token': token,
        'minWaitMs': 1600,
    })

def handle_captcha_verify(event, body):
    token = (body.get('token') or body.get('captchaToken') or '') if isinstance(body, dict) else ''
    answer = body.get('answer') if isinstance(body, dict) else None
    if body.get('answer') is None and isinstance(body, dict):
        answer = body.get('captchaAnswer')
    ok, err = _verify_register_captcha(token, answer)
    if not ok:
        return _response(400, {'ok': False, 'error': err or 'CaptchaFailed'})
    return _response(200, {'ok': True})

def handle_validate_register_photo(event, body, image_bytes_fixed, img=None, width=None, height=None):
    try:
        detect_resp = rekognition.detect_faces(
            Image={'Bytes': image_bytes_fixed},
            Attributes=['ALL'],
        )
    except Exception as e:
        logger.exception('detect_faces failed (validate-register-photo)')
        return _response(400, {
            'ok': False,
            'error': 'FaceDetectFailed',
            'message': 'No se pudo analizar la foto. Intenta de nuevo.',
            'issues': ['No se pudo analizar la foto. Intenta de nuevo.'],
            'details': str(e),
        })
    face_details = detect_resp.get('FaceDetails') or []
    photo_issues = _register_photo_issues(face_details)
    if photo_issues:
        return _response(400, {
            'ok': False,
            'error': 'InvalidFacePhoto',
            'message': photo_issues[0],
            'issues': photo_issues,
        })
    return _response(200, {'ok': True, 'issues': []})

def handle_register(event, body, image_bytes_fixed, img=None, width=None, height=None):
    student_code = (body.get('studentCode') or body.get('codigoEstudiante') or '').strip()
    first_name = (body.get('firstName') or body.get('nombre') or '').strip()
    last_name = (body.get('lastName') or body.get('apellidos') or '').strip()
    full_name = (body.get('fullName') or body.get('nombreEstudiante') or '').strip()
    email = (body.get('email') or body.get('correo') or '').strip().lower()
    role = (body.get('role') or 'student').strip().lower()
    password = (body.get('password') or body.get('contrasena') or '').strip()

    # Consentimientos
    accept_terms = body.get('acceptTerms') if isinstance(body, dict) else None
    accept_privacy = body.get('acceptPrivacy') if isinstance(body, dict) else None
    consent_biometric = body.get('consentBiometric') if isinstance(body, dict) else None

    honeypot = ''
    if isinstance(body, dict):
        honeypot = str(body.get('website') or body.get('company') or body.get('honeypot') or '').strip()
    if honeypot:
        return _response(400, {'error': 'CaptchaFailed', 'message': 'No se pudo verificar el registro.'})

    captcha_ok, captcha_err = _verify_register_captcha(
        body.get('captchaToken') if isinstance(body, dict) else None,
        body.get('captchaAnswer') if isinstance(body, dict) else None,
    )
    if not captcha_ok:
        messages = {
            'CaptchaInvalid': 'Completa la verificación de que no eres un robot.',
            'CaptchaTooFast': 'Responde el reto con calma e inténtalo de nuevo.',
            'CaptchaFailed': 'La verificación del captcha no es correcta. Intenta otra vez.',
        }
        return _response(400, {
            'error': captcha_err or 'CaptchaFailed',
            'message': messages.get(captcha_err, 'Completa la verificación de que no eres un robot.'),
        })

    if role != 'student':
        return _response(400, {'error': 'Only student registration is supported'})

    # Validar nombre y apellidos separados o fullName combinado
    if not full_name:
        if not first_name or not last_name:
            return _response(400, {'error': 'Missing fields: firstName and lastName (or fullName)'})
        full_name = f"{first_name} {last_name}"

    if not student_code or not full_name or not email or not password:
        return _response(400, {'error': 'Missing fields: studentCode, fullName (or firstName+lastName), email, password'})

    # Validar longitud del código estudiantil
    if len(student_code) < 8:
        return _response(400, {'error': 'StudentCodeTooShort', 'message': 'El código estudiantil debe tener mínimo 8 caracteres'})
    if len(student_code) > 10:
        return _response(400, {'error': 'StudentCodeTooLong', 'message': 'El código estudiantil debe tener máximo 10 caracteres'})

    # Validar dominio del correo
    if not email.endswith('@academia.umb.edu.co'):
        return _response(400, {'error': 'InvalidEmailDomain', 'message': 'El correo debe terminar en @academia.umb.edu.co'})

    email_code = ''
    if isinstance(body, dict):
        email_code = str(body.get('emailCode') or body.get('codigoCorreo') or '').strip()
    code_ok, code_error = _register_email_code_ok(email, email_code)
    if not code_ok:
        return code_error

    # Validar complejidad de la contraseña
    if len(password) < 8:
        return _response(400, {'error': 'PasswordTooShort', 'message': 'La contraseña debe tener mínimo 8 caracteres'})
    if not any(c.isupper() for c in password):
        return _response(400, {'error': 'PasswordMissingUppercase', 'message': 'La contraseña debe incluir al menos una mayúscula'})
    if not any(c.islower() for c in password):
        return _response(400, {'error': 'PasswordMissingLowercase', 'message': 'La contraseña debe incluir al menos una minúscula'})
    if not any(c.isdigit() for c in password):
        return _response(400, {'error': 'PasswordMissingNumber', 'message': 'La contraseña debe incluir al menos un número'})
    if not any(c in '!@#$%^&*(),.?":{}|<>' for c in password):
        return _response(400, {'error': 'PasswordMissingSpecial', 'message': 'La contraseña debe incluir al menos un carácter especial'})

    # Validar consentimientos obligatorios
    if not accept_terms:
        return _response(400, {'error': 'TermsNotAccepted', 'message': 'Debe aceptar los Términos y Condiciones'})
    if not accept_privacy:
        return _response(400, {'error': 'PrivacyNotAccepted', 'message': 'Debe aceptar la Política de Privacidad'})
    if not consent_biometric:
        return _response(400, {'error': 'BiometricConsentNotAccepted', 'message': 'Debe autorizar el tratamiento de datos biométricos'})

    # Verificar si el código de estudiante ya está registrado
    try:
        scan_resp = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#SC = :sc AND #R = :r',
            ExpressionAttributeNames={'#SC': 'StudentCode', '#R': 'Role'},
            ExpressionAttributeValues={':sc': {'S': student_code}, ':r': {'S': 'student'}},
            Limit=1,
        )
        items = (scan_resp or {}).get('Items') or []
        if items:
            existing_item = items[0]
            existing_email = _ddb_s(existing_item, 'Email')
            existing_name = _ddb_s(existing_item, 'FullName')

            error_msg = f'El código de estudiante {student_code} ya está registrado'
            if existing_name:
                error_msg += f' en el estudiante {existing_name}'
            if existing_email and existing_email != email:
                error_msg += f' ({existing_email})'

            logger.warning(f'StudentCode already registered: code={student_code}, existing_email={existing_email}, new_email={email}')
            return _response(409, {
                'error': 'StudentCodeAlreadyRegistered',
                'message': error_msg,
                'existingEmail': existing_email
            })
    except Exception as e:
        logger.warning(f'StudentCode duplicate check failed: {e}')
        # Continuar con el registro si falla la verificación

    salt_hex = _new_salt_hex()
    pw_hash = _hash_password(password, salt_hex)

    detect_resp = rekognition.detect_faces(Image={'Bytes': image_bytes_fixed}, Attributes=['ALL'])
    face_details = detect_resp.get('FaceDetails', [])
    photo_issues = _register_photo_issues(face_details)
    if photo_issues:
        return _response(400, {
            'error': 'InvalidFacePhoto',
            'message': photo_issues[0],
            'issues': photo_issues,
        })

    # Verificar si el rostro ya está registrado en la colección
    try:
        search_resp = rekognition.search_faces_by_image(
            CollectionId=COLLECTION,
            Image={'Bytes': image_bytes_fixed},
            FaceMatchThreshold=95,  # Umbral alto para evitar falsos positivos
            MaxFaces=1
        )
        matches = search_resp.get('FaceMatches', [])
        if matches:
            # Rostro ya registrado
            best_match = matches[0]
            similarity = float(best_match.get('Similarity', 0))
            face_id = best_match.get('Face', {}).get('FaceId')

            # Obtener información del estudiante existente
            existing_email = None
            existing_name = None
            if face_id:
                try:
                    ddb_resp = dynamodb.get_item(
                        TableName=DDB_TABLE,
                        Key={'RekognitionId': {'S': face_id}}
                    )
                    existing_item = (ddb_resp or {}).get('Item')
                    if existing_item:
                        existing_email = _ddb_s(existing_item, 'Email')
                        existing_name = _ddb_s(existing_item, 'FullName')
                except Exception:
                    pass

            error_msg = 'Este rostro ya está registrado'
            if existing_name:
                error_msg += f' en el estudiante {existing_name}'
            if existing_email and existing_email != email:
                error_msg += f' ({existing_email})'

            logger.warning(f'Face already registered: similarity={similarity}%, existing_email={existing_email}, new_email={email}')
            return _response(409, {
                'error': 'FaceAlreadyRegistered',
                'message': error_msg,
                'similarity': similarity,
                'existingEmail': existing_email
            })
    except Exception as e:
        logger.warning(f'Face duplicate check failed: {e}')
        # Continuar con el registro si falla la verificación

    try:
        index_resp = rekognition.index_faces(
            CollectionId=COLLECTION,
            Image={'Bytes': image_bytes_fixed},
            MaxFaces=1,
            QualityFilter='AUTO',
            DetectionAttributes=['DEFAULT']
        )
    except Exception as e:
        logger.exception('index_faces failed')
        details = str(e)
        if isinstance(e, ClientError):
            err = (e.response or {}).get('Error') or {}
            details = {
                'code': err.get('Code'),
                'message': err.get('Message'),
                'collection': COLLECTION,
                'region': REGION
            }
        return _response(500, {'error': 'IndexFacesFailed', 'details': details})

    records = index_resp.get('FaceRecords', [])
    if not records:
        return _response(400, {'error': 'No se pudo indexar el rostro. Intenta otra foto.'})

    face_id = records[0]['Face']['FaceId']
    now = int(time.time())

    try:
        dynamodb.put_item(
            TableName=DDB_TABLE,
            Item={
                'RekognitionId': {'S': face_id},
                'FullName': {'S': full_name},
                'StudentCode': {'S': student_code},
                'Email': {'S': email},
                'Role': {'S': 'student'},
                'PasswordSalt': {'S': salt_hex},
                'PasswordHash': {'S': pw_hash},
                'AcceptTerms': {'BOOL': bool(accept_terms)},
                'AcceptPrivacy': {'BOOL': bool(accept_privacy)},
                'ConsentBiometric': {'BOOL': bool(consent_biometric)},
                'BiometricConsent': {'BOOL': bool(consent_biometric)},
                'ConsentUpdatedAt': {'N': str(now)},
                'BiometricConsentUpdatedAt': {'N': str(now)},
            }
        )
    except Exception as e:
        logger.exception('DynamoDB put_item failed')
        return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})

    _clear_register_email_code(email)
    return _response(200, {
        'ok': True,
        'faceId': face_id,
        'studentCode': student_code,
        'fullName': full_name,
        'email': email
    })


def _account_for_session(email: str, role: str) -> dict | None:
    email = (email or '').strip().lower()
    if role == 'student':
        return _scan_find_student_by_email(email)
    try:
        resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': f'USER#{email}'}})
    except Exception:
        logger.exception('DynamoDB get_item failed (account-for-session)')
        return None
    item = (resp or {}).get('Item')
    if not item or _ddb_s(item, 'Role') != role:
        return None
    return item


def _account_by_email(email: str) -> dict | None:
    email = (email or '').strip().lower()
    if not email:
        return None
    try:
        resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': f'USER#{email}'}})
        item = (resp or {}).get('Item')
    except Exception:
        logger.exception('DynamoDB get_item failed (account-by-email)')
        item = None
    if item and _ddb_s(item, 'PasswordHash') and _ddb_s(item, 'Role') in ('teacher', 'admin'):
        return item
    student = _scan_find_student_by_email(email)
    if student and _ddb_s(student, 'PasswordHash'):
        return student
    return None


def _apply_new_password(pk: str, new_password: str, clear_reset: bool = False):
    salt_hex = _new_salt_hex()
    pw_hash = _hash_password(new_password, salt_hex)
    update = 'SET PasswordSalt = :salt, PasswordHash = :hash, MustChangePassword = :must'
    values = {
        ':salt': {'S': salt_hex},
        ':hash': {'S': pw_hash},
        ':must': {'BOOL': False},
    }
    if clear_reset:
        update += ' REMOVE ResetCodeHash, ResetCodeSalt, ResetCodeExp, ResetCodeSentAt'
    dynamodb.update_item(
        TableName=DDB_TABLE,
        Key={'RekognitionId': {'S': pk}},
        UpdateExpression=update,
        ExpressionAttributeValues=values,
    )


def handle_change_password(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    role = str((payload or {}).get('role') or '')
    if not payload or role not in ('student', 'teacher', 'admin'):
        return _response(401, {'error': 'Unauthorized'})

    email = str(payload.get('sub') or '').strip().lower()
    current = (body.get('currentPassword') or body.get('password') or '').strip() if isinstance(body, dict) else ''
    new_password = (body.get('newPassword') or body.get('nuevaContrasena') or '').strip() if isinstance(body, dict) else ''
    if not email or not current or not new_password:
        return _response(400, {'error': 'Missing fields: currentPassword, newPassword', 'message': 'Escribe la contraseña actual y la nueva.'})

    item = _account_for_session(email, role)
    if not item:
        return _response(404, {'error': 'UserNotFound', 'message': 'No encontramos la cuenta.'})

    salt_hex = _ddb_s(item, 'PasswordSalt')
    stored_hash = _ddb_s(item, 'PasswordHash')
    if not salt_hex or not stored_hash or _hash_password(current, salt_hex) != stored_hash:
        return _response(400, {'error': 'InvalidCurrentPassword', 'message': 'La contraseña actual no coincide.'})
    if _hash_password(new_password, salt_hex) == stored_hash:
        return _response(400, {'error': 'PasswordUnchanged', 'message': 'La nueva contraseña debe ser distinta a la actual.'})

    issue = _password_issue(new_password)
    if issue:
        return _response(400, {'error': issue[0], 'message': issue[1]})

    pk = _ddb_s(item, 'RekognitionId')
    if not pk:
        return _response(500, {'error': 'UserKeyMissing'})
    try:
        _apply_new_password(pk, new_password, clear_reset=True)
    except Exception as e:
        logger.exception('DynamoDB update_item failed (change-password)')
        return _response(500, {'error': 'DynamoDBUpdateFailed', 'details': str(e)})

    _audit_log(email, role, 'change-password', {})
    return _response(200, {'ok': True, 'mustChangePassword': False})


_FORGOT_MESSAGE = 'Si el correo está registrado, enviamos un código para restablecer la contraseña. Revisa la bandeja y el correo no deseado.'
_EMAIL_NOT_CONFIGURED = 'La recuperación por correo no está disponible. Falta el remitente SesFromEmail, verificado en Amazon SES (us-east-2).'
_STUDENT_EMAIL_DOMAIN = '@academia.umb.edu.co'


def _verify_pk(email: str) -> str:
    return f"VERIFY#{email.strip().lower()}"


def _register_email_code_ok(email: str, code: str):
    if not SES_FROM_EMAIL:
        return False, _response(503, {
            'error': 'EmailNotConfigured',
            'message': 'No se puede verificar el correo porque el envío no está configurado.',
        })
    if not code.isdigit() or len(code) != 6:
        return False, _response(400, {
            'error': 'EmailCodeRequired',
            'message': 'Escribe el código de 6 dígitos que enviamos a tu correo.',
        })
    try:
        resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': _verify_pk(email)}},
        )
    except Exception as e:
        logger.exception('DynamoDB get_item failed (register email code)')
        return False, _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})
    item = (resp or {}).get('Item')
    exp = int(_ddb_n(item or {}, 'CodeExp') or '0')
    code_salt = _ddb_s(item or {}, 'CodeSalt')
    code_hash = _ddb_s(item or {}, 'CodeHash')
    now = int(time.time())
    if not item or not exp or now > exp or not code_salt or not code_hash:
        return False, _response(400, {
            'error': 'InvalidEmailCode',
            'message': 'El código no es válido o ya venció. Pide uno nuevo.',
        })
    if not hmac.compare_digest(_hash_password(code, code_salt), code_hash):
        return False, _response(400, {
            'error': 'InvalidEmailCode',
            'message': 'El código no es válido o ya venció. Pide uno nuevo.',
        })
    return True, None


def _clear_register_email_code(email: str):
    try:
        dynamodb.delete_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': _verify_pk(email)}},
        )
    except Exception:
        logger.exception('DynamoDB delete_item failed (register email code)')


def handle_request_register_code(event, body):
    email = (body.get('email') or body.get('correo') or '').strip().lower() if isinstance(body, dict) else ''
    if not email:
        return _response(400, {'error': 'Missing field: email', 'message': 'Escribe el correo institucional.'})
    if not email.endswith(_STUDENT_EMAIL_DOMAIN) or email.startswith('@') or email.count('@') != 1:
        return _response(400, {
            'error': 'InvalidEmailDomain',
            'message': 'El correo debe terminar en @academia.umb.edu.co',
        })
    if not SES_FROM_EMAIL:
        return _response(503, {
            'error': 'EmailNotConfigured',
            'message': 'No se puede enviar el código porque el correo de salida no está configurado.',
        })
    if _account_by_email(email):
        return _response(409, {
            'error': 'EmailAlreadyRegistered',
            'message': 'Ese correo ya tiene una cuenta. Inicia sesión o recupera la contraseña.',
        })

    pk = _verify_pk(email)
    now = int(time.time())
    try:
        existing = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': pk}})
    except Exception as e:
        logger.exception('DynamoDB get_item failed (request-register-code)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})
    prev = (existing or {}).get('Item') or {}
    sent_at = int(_ddb_n(prev, 'CodeSentAt') or '0')
    if sent_at and now - sent_at < 60:
        return _response(429, {
            'error': 'EmailCodeTooSoon',
            'message': 'Espera un momento antes de pedir otro código.',
        })

    code = f'{secrets.randbelow(1000000):06d}'
    code_salt = _new_salt_hex()
    item = {
        'RekognitionId': {'S': pk},
        'Type': {'S': 'EmailVerification'},
        'Email': {'S': email},
        'CodeSalt': {'S': code_salt},
        'CodeHash': {'S': _hash_password(code, code_salt)},
        'CodeExp': {'N': str(now + 15 * 60)},
        'CodeSentAt': {'N': str(now)},
    }
    try:
        dynamodb.put_item(TableName=DDB_TABLE, Item=item)
    except Exception as e:
        logger.exception('DynamoDB put_item failed (request-register-code)')
        return _response(500, {'error': 'DynamoDBPutFailed', 'details': str(e)})

    sent = _send_text_email(
        email,
        'Código para verificar tu correo',
        (
            f'Tu código de registro en Toma Asistencia UMB es {code}.\n'
            'Vence en 15 minutos. Si no estás creando una cuenta, ignora este correo.\n'
        ),
    )
    if not sent:
        _clear_register_email_code(email)
        logger.warning('register email code was not delivered')
        return _response(503, {
            'error': 'EmailNotDelivered',
            'message': 'No se pudo enviar el código. Revisa que el correo pueda recibir mensajes.',
        })
    return _response(200, {
        'ok': True,
        'message': 'Enviamos un código de 6 dígitos a tu correo. Revisa la bandeja y el correo no deseado.',
    })


def handle_forgot_password(event, body):
    email = (body.get('email') or body.get('correo') or '').strip().lower() if isinstance(body, dict) else ''
    if not email or '@' not in email:
        return _response(400, {'error': 'Missing field: email', 'message': 'Escribe el correo de la cuenta.'})
    if not SES_FROM_EMAIL:
        return _response(503, {
            'error': 'EmailNotConfigured',
            'message': _EMAIL_NOT_CONFIGURED,
        })

    item = _account_by_email(email)
    if not item:
        return _response(200, {'ok': True, 'message': _FORGOT_MESSAGE})

    now = int(time.time())
    sent_at = int(_ddb_n(item, 'ResetCodeSentAt') or '0')
    if sent_at and now - sent_at < 60:
        return _response(200, {'ok': True, 'message': _FORGOT_MESSAGE})

    code = f'{secrets.randbelow(1000000):06d}'
    code_salt = _new_salt_hex()
    pk = _ddb_s(item, 'RekognitionId')
    try:
        dynamodb.update_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': pk}},
            UpdateExpression='SET ResetCodeSalt = :salt, ResetCodeHash = :hash, ResetCodeExp = :exp, ResetCodeSentAt = :sent',
            ExpressionAttributeValues={
                ':salt': {'S': code_salt},
                ':hash': {'S': _hash_password(code, code_salt)},
                ':exp': {'N': str(now + 15 * 60)},
                ':sent': {'N': str(now)},
            },
        )
    except Exception as e:
        logger.exception('DynamoDB update_item failed (forgot-password)')
        return _response(500, {'error': 'DynamoDBUpdateFailed', 'details': str(e)})

    sent = _send_text_email(
        email,
        'Código para restablecer tu contraseña',
        (
            f'Tu código de Toma Asistencia UMB es {code}.\n'
            'Vence en 15 minutos. Si no solicitaste este cambio, ignora este correo.\n'
        ),
    )
    if not sent:
        logger.warning('forgot-password email was not delivered')
    return _response(200, {'ok': True, 'message': _FORGOT_MESSAGE})


def handle_reset_password(event, body):
    email = (body.get('email') or body.get('correo') or '').strip().lower() if isinstance(body, dict) else ''
    code = (body.get('code') or body.get('codigo') or '').strip() if isinstance(body, dict) else ''
    new_password = (body.get('newPassword') or body.get('nuevaContrasena') or '').strip() if isinstance(body, dict) else ''
    if not email or not code or not new_password:
        return _response(400, {'error': 'Missing fields: email, code, newPassword', 'message': 'Escribe el correo, el código y la nueva contraseña.'})

    issue = _password_issue(new_password)
    if issue:
        return _response(400, {'error': issue[0], 'message': issue[1]})

    item = _account_by_email(email)
    if not item:
        return _response(400, {'error': 'InvalidResetCode', 'message': 'El código no es válido o ya venció.'})

    exp = int(_ddb_n(item, 'ResetCodeExp') or '0')
    code_salt = _ddb_s(item, 'ResetCodeSalt')
    code_hash = _ddb_s(item, 'ResetCodeHash')
    now = int(time.time())
    if not exp or now > exp or not code_salt or not code_hash:
        return _response(400, {'error': 'InvalidResetCode', 'message': 'El código no es válido o ya venció.'})
    if not hmac.compare_digest(_hash_password(code, code_salt), code_hash):
        return _response(400, {'error': 'InvalidResetCode', 'message': 'El código no es válido o ya venció.'})

    pk = _ddb_s(item, 'RekognitionId')
    try:
        _apply_new_password(pk, new_password, clear_reset=True)
    except Exception as e:
        logger.exception('DynamoDB update_item failed (reset-password)')
        return _response(500, {'error': 'DynamoDBUpdateFailed', 'details': str(e)})

    _audit_log(email, _ddb_s(item, 'Role') or None, 'reset-password', {})
    return _response(200, {'ok': True, 'message': 'La contraseña quedó actualizada. Ya puedes iniciar sesión.'})

