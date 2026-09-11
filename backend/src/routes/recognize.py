from runtime import *  # noqa: F401,F403

def handle_recognize_class(event, body):
    token = _get_bearer_token(event)
    payload = _verify_token(token)
    if not payload or payload.get('role') != 'teacher':
        return _response(401, {'error': 'Unauthorized'})

    teacher = str(payload.get('sub') or '').strip().lower()
    class_id = (body.get('classId') or '').strip()
    if not class_id:
        return _response(400, {'error': 'Missing field: classId'})

    image_b64 = body.get('imageBase64') if isinstance(body, dict) else None
    if not image_b64:
        return _response(400, {'error': 'Missing "imageBase64" in request body'})

    if isinstance(image_b64, str) and image_b64.startswith('data:'):
        image_b64 = image_b64.split(',', 1)[1]

    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception as e:
        return _response(400, {'error': 'Invalid base64 image', 'details': str(e)})

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
        class_resp = dynamodb.get_item(
            TableName=DDB_TABLE,
            Key={'RekognitionId': {'S': f"CLASS#{class_id}"}}
        )
        class_item = (class_resp or {}).get('Item')
    except Exception as e:
        logger.exception('DynamoDB get_item failed (recognize-class)')
        return _response(500, {'error': 'DynamoDBGetFailed', 'details': str(e)})

    if not class_item:
        return _response(404, {'error': 'ClassNotFound'})

    class_teacher = _ddb_s(class_item, 'TeacherEmail').strip().lower()
    if class_teacher and class_teacher != teacher:
        return _response(403, {'error': 'Forbidden'})

    try:
        enroll_scan = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#T = :t AND #CID = :cid',
            ExpressionAttributeNames={'#T': 'Type', '#CID': 'ClassId'},
            ExpressionAttributeValues={':t': {'S': 'Enrollment'}, ':cid': {'S': class_id}},
            Limit=300,
        )
    except Exception as e:
        logger.exception('DynamoDB scan failed (recognize-class enrollments)')
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

    student_profile_by_email = {}
    try:
        scan_students = dynamodb.scan(
            TableName=DDB_TABLE,
            FilterExpression='#R = :r',
            ExpressionAttributeNames={'#R': 'Role'},
            ExpressionAttributeValues={':r': {'S': 'student'}},
            Limit=800,
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

    for se in roster_emails:
        prof = student_profile_by_email.get(se)
        if not prof:
            continue
        if not roster_by_email[se].get('studentName'):
            roster_by_email[se]['studentName'] = prof.get('studentName')
        if not roster_by_email[se].get('studentCode'):
            roster_by_email[se]['studentCode'] = prof.get('studentCode')

    try:
        detect_resp = rekognition.detect_faces(Image={'Bytes': image_bytes_fixed}, Attributes=['DEFAULT'])
        face_details = detect_resp.get('FaceDetails', [])
    except Exception as e:
        return _response(500, {'error': 'DetectFacesFailed', 'details': str(e)})

    face_count = len(face_details or [])
    per_face = []
    recognized_best_by_email = {}

    def _resolve_faceid_to_student(face_id: str) -> dict | None:
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
        if not email_found:
            return None

        return {
            'studentEmail': email_found,
            'studentName': _ddb_s(it, 'FullName') or None,
            'studentCode': _ddb_s(it, 'StudentCode') or None,
        }

    def _search_best_match(img_bytes: bytes) -> dict | None:
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
        conf = float(best.get('Similarity') or 0.0)
        st = _resolve_faceid_to_student(str(face_id))
        if not st:
            return None
        st['confidence'] = conf
        return st

    if face_count and PIL_AVAILABLE and img is not None:
        for idx, fd in enumerate(face_details):
            bb = (fd or {}).get('BoundingBox') or {}
            cropped_bytes = None
            try:
                cropped_bytes = _crop_face_bytes(img, bb)
            except Exception:
                cropped_bytes = image_bytes_fixed

            best = _search_best_match(cropped_bytes)
            if best and (best.get('studentEmail') or '').strip().lower() in roster_by_email:
                e = (best.get('studentEmail') or '').strip().lower()
                prev = recognized_best_by_email.get(e)
                if (prev is None) or (float(best.get('confidence') or 0.0) > float(prev.get('confidence') or 0.0)):
                    recognized_best_by_email[e] = best

            per_face.append({
                'faceIndex': idx + 1,
                'bestMatch': best if best and (best.get('studentEmail') or '').strip().lower() in roster_by_email else None,
            })
    else:
        best = _search_best_match(image_bytes_fixed)
        if best and (best.get('studentEmail') or '').strip().lower() in roster_by_email:
            e = (best.get('studentEmail') or '').strip().lower()
            recognized_best_by_email[e] = best
        per_face = [{'faceIndex': 1, 'bestMatch': best}]

    recognized = list(recognized_best_by_email.values())
    present_set = set((r.get('studentEmail') or '').strip().lower() for r in recognized if r.get('studentEmail'))

    roster = []
    for se in roster_emails:
        base_info = roster_by_email.get(se) or {'studentEmail': se}
        roster.append({
            'studentEmail': se,
            'studentName': base_info.get('studentName'),
            'studentCode': base_info.get('studentCode'),
            'present': se in present_set,
        })

    return _response(200, {
        'ok': True,
        'classId': class_id,
        'facesDetected': face_count,
        'perFace': per_face,
        'recognized': recognized,
        'roster': roster,
    })

def handle_recognize(event, body, image_bytes_fixed, img=None, width=None, height=None):
    # 1) Detect faces (use EXIF-corrected bytes for consistent coordinates)
    detect_resp = rekognition.detect_faces(Image={'Bytes': image_bytes_fixed}, Attributes=['DEFAULT'])
    face_details = detect_resp.get('FaceDetails', [])
    if not face_details:
        return _response(200, {
            'facesDetected': 0,
            'matches': [],
            'recognized': False,
            'message': 'No faces detected'
        })

    results = []
    per_face = []
    recognized_any = False

    if not PIL_AVAILABLE or img is None or width is None or height is None or RESAMPLE is None:
        if len(face_details) > 1:
            return _response(501, {
                'error': 'MultiFaceRequiresPillow',
                'message': 'Para reconocer múltiples rostros se requiere Pillow en Lambda. Re-deploy con sam build --use-container para incluir dependencias.',
                'pillowImportError': PIL_IMPORT_ERROR,
                'facesDetected': len(face_details),
                'matches': [],
                'recognized': False,
                'perFace': [{'faceIndex': i, 'matches': []} for i in range(1, len(face_details) + 1)]
            })
        try:
            search_resp = rekognition.search_faces_by_image(
                CollectionId=COLLECTION,
                Image={'Bytes': image_bytes_fixed},
                FaceMatchThreshold=FACE_MATCH_THRESHOLD,
                MaxFaces=MAX_MATCHES
            )
        except Exception as e:
            logger.warning(f"search_faces_by_image failed: {e}")
            return _response(200, {
                'facesDetected': len(face_details),
                'matches': [],
                'recognized': False,
                'perFace': []
            })

        face_matches = []
        for m in search_resp.get('FaceMatches', []):
            fid = m['Face']['FaceId']
            conf = float(m['Face']['Confidence'])
            full_name = None
            try:
                ddb_resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': fid}})
                if 'Item' in ddb_resp:
                    full_name = ddb_resp['Item'].get('FullName', {}).get('S')
            except Exception as e:
                logger.warning(f'DynamoDB get_item failed for FaceId {fid}: {e}')

            if full_name:
                recognized_any = True

            item = {
                'faceId': fid,
                'confidence': conf,
                'fullName': full_name,
                'faceIndex': 1
            }
            results.append(item)
            face_matches.append(item)

        per_face.append({'faceIndex': 1, 'matches': face_matches})
    else:
        padding_ratio = 0.20
        min_pixels = 120

        for idx, fd in enumerate(face_details, start=1):
            box = fd.get('BoundingBox', {})
            try:
                left = int(box.get('Left', 0) * width)
                top = int(box.get('Top', 0) * height)
                w_box = int(box.get('Width', 0) * width)
                h_box = int(box.get('Height', 0) * height)

                pad = int(padding_ratio * max(w_box, h_box))
                l = max(0, left - pad)
                t = max(0, top - pad)
                r = min(width, left + w_box + pad)
                b = min(height, top + h_box + pad)

                if r <= l or b <= t:
                    raise ValueError("invalid crop coordinates")

                cropped = img.crop((l, t, r, b))
                if cropped.width < min_pixels or cropped.height < min_pixels:
                    new_w = max(min_pixels, cropped.width)
                    new_h = max(min_pixels, cropped.height)
                    cropped = cropped.resize((new_w, new_h), RESAMPLE)

                face_bytes = _bytes_from_pil(cropped)

            except Exception as e:
                logger.info(f"Skipping face {idx}: crop error: {e}")
                per_face.append({'faceIndex': idx, 'matches': []})
                continue

            try:
                search_resp = rekognition.search_faces_by_image(
                    CollectionId=COLLECTION,
                    Image={'Bytes': face_bytes},
                    FaceMatchThreshold=FACE_MATCH_THRESHOLD,
                    MaxFaces=MAX_MATCHES
                )
            except Exception as e:
                logger.warning(f"search_faces_by_image failed for face {idx}: {e}")
                per_face.append({'faceIndex': idx, 'matches': []})
                continue

            face_matches = []
            for m in search_resp.get('FaceMatches', []):
                fid = m['Face']['FaceId']
                conf = float(m['Face']['Confidence'])
                full_name = None
                try:
                    ddb_resp = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': fid}})
                    if 'Item' in ddb_resp:
                        full_name = ddb_resp['Item'].get('FullName', {}).get('S')
                except Exception as e:
                    logger.warning(f'DynamoDB get_item failed for FaceId {fid}: {e}')

                if full_name:
                    recognized_any = True

                item = {
                    'faceId': fid,
                    'confidence': conf,
                    'fullName': full_name,
                    'faceIndex': idx
                }
                results.append(item)
                face_matches.append(item)

            per_face.append({'faceIndex': idx, 'matches': face_matches})

    return _response(200, {
        'facesDetected': len(face_details),
        'matches': results,
        'recognized': recognized_any,
        'perFace': per_face
    })

