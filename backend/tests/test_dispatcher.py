"""Contract tests for the Lambda dispatcher (no real AWS calls)."""
from __future__ import annotations

import json
import os
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

# runtime lee el secreto al importarse; las rutas copian el valor con `from runtime import *`.
os.environ.setdefault("AUTH_SECRET", "test-secret-no-usar-en-produccion")

if "boto3" not in sys.modules:
    boto3_stub = types.ModuleType("boto3")
    boto3_stub.client = MagicMock(return_value=MagicMock())
    sys.modules["boto3"] = boto3_stub
if "botocore" not in sys.modules:
    botocore_stub = types.ModuleType("botocore")
    exceptions = types.ModuleType("botocore.exceptions")

    class ClientError(Exception):
        def __init__(self, error_response=None, operation_name=""):
            super().__init__(str(error_response))
            self.response = error_response or {}
            self.operation_name = operation_name

    exceptions.ClientError = ClientError
    botocore_stub.exceptions = exceptions
    sys.modules["botocore"] = botocore_stub
    sys.modules["botocore.exceptions"] = exceptions

from lambda_handler import IMAGE_ROUTES, ROUTE_HANDLERS, ROUTE_SUFFIXES, lambda_handler  # noqa: E402
from runtime import _absence_warning_action  # noqa: E402

REMOVED_SUFFIXES = ["/forgot-password", "/request-register-code", "/reset-password"]

EXPECTED_SUFFIXES = [
    "/register-teacher",
    "/login-teacher",
    "/login-admin",
    "/set-consent",
    "/update-my-profile",
    "/admin-students",
    "/admin-students-by-class",
    "/admin-update-student",
    "/admin-delete-student",
    "/admin-teachers",
    "/admin-update-teacher",
    "/admin-delete-teacher",
    "/admin-logs",
    "/admin-consents",
    "/admin-create-teacher",
    "/admin-bulk-import",
    "/admin-dashboard-stats",
    "/admin-request-profile",
    "/login-student",
    "/change-password",
    "/create-class",
    "/update-class",
    "/create-attendance-qr",
    "/mark-attendance",
    "/attendance-details",
    "/set-attendance-status",
    "/confirm-attendance-photo",
    "/attendance-report",
    "/join-class",
    "/my-classes",
    "/student-daily-summary",
    "/student-notifications",
    "/mark-notifications-read",
    "/student-attendance-history",
    "/submit-justification",
    "/list-justifications",
    "/review-justification",
    "/class-details",
    "/regenerate-class-qr",
    "/remove-student-from-class",
    "/delete-class",
    "/recognize-class",
    "/captcha-challenge",
    "/captcha-verify",
    "/validate-register-photo",
    "/register",
    "/recognize",
]


def _event(path: str, method: str = "POST", body=None, headers=None):
    payload = json.dumps(body) if body is not None else "{}"
    return {
        "httpMethod": method,
        "path": path,
        "requestContext": {"http": {"method": method, "path": path}, "httpMethod": method, "path": path},
        "headers": headers or {"Content-Type": "application/json"},
        "body": payload,
        "isBase64Encoded": False,
    }


def _body(resp):
    return json.loads(resp["body"])


def test_all_original_suffixes_registered():
    registered = set(ROUTE_SUFFIXES)
    missing = [s for s in EXPECTED_SUFFIXES if s not in registered]
    extra_ok = True
    assert not missing, f"Lost routes after split: {missing}"
    assert extra_ok
    assert "/create-class" in dict(ROUTE_HANDLERS)
    assert "/register" in dict(IMAGE_ROUTES)


def test_options_cors():
    resp = lambda_handler(_event("/Prod/login-student", method="OPTIONS"), None)
    assert resp["statusCode"] == 200
    assert _body(resp)["message"] == "ok"


def test_recognize_missing_image():
    resp = lambda_handler(_event("/Prod/recognize", body={}), None)
    assert resp["statusCode"] == 400
    assert "imageBase64" in _body(resp)["error"]


def test_login_student_missing_fields():
    resp = lambda_handler(_event("/Prod/login-student", body={}), None)
    assert resp["statusCode"] == 400
    assert "Missing fields" in _body(resp)["error"]


def test_login_teacher_missing_fields():
    resp = lambda_handler(_event("/Prod/login-teacher", body={"email": "a@b.c"}), None)
    assert resp["statusCode"] == 400


def test_change_password_unauthorized():
    resp = lambda_handler(_event("/Prod/change-password", body={"currentPassword": "a", "newPassword": "b"}), None)
    assert resp["statusCode"] == 401


def test_justification_deadline_adds_seven_days():
    import datetime
    from routes.justifications import justification_deadline_epoch
    deadline = justification_deadline_epoch('2026-09-01', None)
    end = datetime.datetime(2026, 9, 1, 23, 59, 59, tzinfo=datetime.timezone(datetime.timedelta(hours=-5)))
    assert deadline == int(end.timestamp()) + 7 * 24 * 3600


def test_absence_warning_fires_once_at_three():
    assert _absence_warning_action(2, False) == 'clear'
    assert _absence_warning_action(3, False) == 'send'
    assert _absence_warning_action(3, True) == 'skip'
    assert _absence_warning_action(4, True) == 'skip'


def test_create_class_unauthorized():
    resp = lambda_handler(_event("/Prod/create-class", body={"className": "x"}), None)
    assert resp["statusCode"] == 401
    assert _body(resp)["error"] == "Unauthorized"


def test_mark_attendance_unauthorized():
    resp = lambda_handler(_event("/Prod/mark-attendance", body={}), None)
    assert resp["statusCode"] == 401


def test_unknown_route_does_not_ask_image():
    resp = lambda_handler(_event("/Prod/admin-request-profile-missing", body={"email": "a@b.c"}), None)
    assert resp["statusCode"] == 404
    assert _body(resp)["error"] == "UnknownRoute"


def test_admin_request_profile_unauthorized():
    resp = lambda_handler(_event("/Prod/admin-request-profile", body={"email": "a@b.c", "role": "teacher"}), None)
    assert resp["statusCode"] == 401
    assert _body(resp)["error"] == "Unauthorized"


def test_admin_bulk_import_unauthorized():
    resp = lambda_handler(_event("/Prod/admin-bulk-import", body={"kind": "docentes", "rows": [{"nombre": "Ana"}]}), None)
    assert resp["statusCode"] == 401
    assert _body(resp)["error"] == "Unauthorized"


def test_bulk_row_helpers():
    from routes.bulk import _cell, _hhmm, _kind_from_body, _schedule_from_days

    assert _hhmm("7:00") == "07:00"
    assert _hhmm("24:00") == ""
    assert _kind_from_body({"kind": "Asignaturas"}) == "asignaturas"
    assert _cell({"Contraseña": "Abc 123!"}, "password", "contraseña", keep_inner=True) == "Abc 123!"
    schedule = _schedule_from_days("lunes|miércoles", "07:00", "09:00")
    assert [block["day"] for block in schedule] == ["MONDAY", "WEDNESDAY"]
    from routes.bulk import _infer_kind
    class_row = {"className": "Prueba de asistencia", "startTime": "07:00", "room": "101", "teacherEmail": "docente1@umb.edu.co"}
    assert _infer_kind("docentes", [class_row]) == "asignaturas"


def test_captcha_challenge_shape():
    resp = lambda_handler(_event("/Prod/captcha-challenge", body={}), None)
    assert resp["statusCode"] == 200
    data = _body(resp)
    assert data.get("ok") is True
    assert "prompt" in data
    assert "options" in data


def _jwt_payload(token):
    from runtime import _b64url_decode
    return json.loads(_b64url_decode(token.split(".")[1]))


def test_captcha_token_does_not_reveal_answer():
    import runtime
    from unittest.mock import patch

    challenge = {"prompt": "x", "options": [3, 5, 7, 9], "answer": 7}
    with patch("routes.auth._build_register_captcha", return_value=challenge):
        data = _body(lambda_handler(_event("/Prod/captcha-challenge", body={}), None))
    payload = _jwt_payload(data["token"])
    assert "ans" not in payload
    assert all(str(v) != "7" for v in payload.values())

    with patch.object(runtime.time, "time", return_value=payload["iat"] + 5):
        assert runtime._verify_register_captcha(data["token"], 7) == (True, "")
        assert runtime._verify_register_captcha(data["token"], 5) == (False, "CaptchaFailed")


def test_removed_code_routes_are_gone():
    for suffix in REMOVED_SUFFIXES:
        assert suffix not in ROUTE_SUFFIXES
        resp = lambda_handler(_event(f"/Prod{suffix}", body={"email": "ana@academia.umb.edu.co"}), None)
        assert resp["statusCode"] == 404


def test_recognize_requires_teacher_or_admin():
    resp = lambda_handler(_event("/Prod/recognize", body={"imageBase64": "aGVsbG8="}), None)
    assert resp["statusCode"] == 401


def test_password_hash_is_scrypt_and_verifies():
    from runtime import _hash_password, _new_salt_hex, _password_needs_upgrade, _verify_password

    salt = _new_salt_hex()
    stored = _hash_password("Clave#2026", salt)
    assert stored.startswith("scrypt$")
    assert _verify_password("Clave#2026", salt, stored)
    assert not _verify_password("Clave#2027", salt, stored)
    assert not _password_needs_upgrade(stored)


def test_legacy_sha256_hash_still_logs_in_and_needs_upgrade():
    import hashlib
    from runtime import _password_needs_upgrade, _verify_password

    salt = "ab" * 16
    legacy = hashlib.sha256((salt + "Clave#2026").encode("utf-8")).hexdigest()
    assert _verify_password("Clave#2026", salt, legacy)
    assert not _verify_password("otra", salt, legacy)
    assert _password_needs_upgrade(legacy)


def test_ddb_scan_follows_pages_and_ignores_limit():
    import runtime
    from unittest.mock import MagicMock, patch

    pages = [
        {"Items": [], "LastEvaluatedKey": {"k": 1}},
        {"Items": [{"id": 1}], "LastEvaluatedKey": {"k": 2}},
        {"Items": [{"id": 2}]},
    ]
    fake = MagicMock()
    fake.scan.side_effect = pages
    with patch.object(runtime, "dynamodb", fake):
        items = runtime._ddb_scan(FilterExpression="x", Limit=1).get("Items")
    assert items == [{"id": 1}, {"id": 2}]
    assert fake.scan.call_count == 3
    assert all("Limit" not in c.kwargs for c in fake.scan.call_args_list)
    assert fake.scan.call_args_list[1].kwargs["ExclusiveStartKey"] == {"k": 1}

    fake = MagicMock()
    fake.scan.side_effect = list(pages)
    with patch.object(runtime, "dynamodb", fake):
        first = runtime._ddb_scan(first_only=True, FilterExpression="x").get("Items")
    assert first == [{"id": 1}]
    assert fake.scan.call_count == 2


def test_admin_dashboard_stats_counts_users():
    # Regresión: el helper del tablero pasaba la paginación por posición y el scan fallaba en silencio.
    import time as _time
    import runtime
    from unittest.mock import MagicMock, patch

    table = [
        {"RekognitionId": {"S": "face-1"}, "Role": {"S": "student"}, "Email": {"S": "ana@academia.umb.edu.co"}, "FullName": {"S": "Ana"}},
        {"RekognitionId": {"S": "USER#doc@umb.edu.co"}, "Role": {"S": "teacher"}, "Email": {"S": "doc@umb.edu.co"}, "FullName": {"S": "Doc"}},
        {"RekognitionId": {"S": "CLASS#c1"}, "Type": {"S": "Class"}, "ClassId": {"S": "c1"}, "TeacherEmail": {"S": "doc@umb.edu.co"}},
    ]

    def fake_scan(**kwargs):
        values = kwargs.get("ExpressionAttributeValues") or {}
        wanted = {v.get("S") for v in values.values() if isinstance(v, dict)}
        rows = [it for it in table if (it.get("Role") or it.get("Type") or {}).get("S") in wanted]
        return {"Items": rows}

    fake = MagicMock()
    fake.scan.side_effect = fake_scan
    now = int(_time.time())
    token = runtime._sign_token({"sub": "admin@umb.edu.co", "role": "admin", "iat": now, "exp": now + 60})
    event = _event("/Prod/admin-dashboard-stats", body={}, headers={"Authorization": f"Bearer {token}"})
    with patch.object(runtime, "dynamodb", fake):
        resp = lambda_handler(event, None)
    assert resp["statusCode"] == 200
    data = _body(resp)
    assert data["students"]["total"] == 1
    assert data["teachers"]["total"] == 1
    assert data["classes"]["total"] == 1


def _admin_event(path, body):
    import time as _time
    import runtime

    now = int(_time.time())
    token = runtime._sign_token({"sub": "admin@umb.edu.co", "role": "admin", "iat": now, "exp": now + 60})
    return _event(path, body=body, headers={"Authorization": f"Bearer {token}"})


def _fake_table(rows):
    from unittest.mock import MagicMock

    def fake_scan(**kwargs):
        values = kwargs.get("ExpressionAttributeValues") or {}
        wanted = {v.get("S") for v in values.values() if isinstance(v, dict)}
        return {"Items": [it for it in rows if (it.get("Role") or it.get("Type") or {}).get("S") in wanted]}

    fake = MagicMock()
    fake.scan.side_effect = fake_scan
    return fake


_STUDENT_PENDING = {"RekognitionId": {"S": "face-1"}, "Role": {"S": "student"}, "Email": {"S": "ana@academia.umb.edu.co"},
                    "FullName": {"S": "Ana"}, "AcceptTerms": {"BOOL": True}, "AcceptPrivacy": {"BOOL": False}}
_TEACHER_PENDING = {"RekognitionId": {"S": "USER#doc@umb.edu.co"}, "Role": {"S": "teacher"}, "Email": {"S": "doc@umb.edu.co"},
                    "FullName": {"S": "Doc"}}


def test_admin_consents_include_teachers():
    import runtime
    from unittest.mock import patch

    with patch.object(runtime, "dynamodb", _fake_table([_STUDENT_PENDING, _TEACHER_PENDING])):
        data = _body(lambda_handler(_admin_event("/Prod/admin-consents", {}), None))
    by_role = {row["role"]: row for row in data["consents"]}
    assert by_role["student"]["missing"] == ["privacy"]
    assert by_role["teacher"]["missing"] == ["terms", "privacy"]
    assert by_role["teacher"]["biometricConsent"] is None


def test_admin_request_all_consents_notifies_pending_users():
    import runtime
    from unittest.mock import patch

    fake = _fake_table([_STUDENT_PENDING, _TEACHER_PENDING])
    fake.get_item.return_value = {}
    with patch.object(runtime, "dynamodb", fake):
        resp = lambda_handler(_admin_event("/Prod/admin-consents", {"action": "request-all", "role": "all"}), None)
    data = _body(resp)
    assert resp["statusCode"] == 200
    assert (data["studentsNotified"], data["teachersNotified"]) == (1, 1)
    notified = {c.kwargs["Item"]["StudentEmail"]["S"] for c in fake.put_item.call_args_list if "StudentEmail" in c.kwargs["Item"]}
    assert notified == {"ana@academia.umb.edu.co", "doc@umb.edu.co"}


def test_admin_classes_summarizes_roster_and_attendance():
    import runtime
    from unittest.mock import patch

    rows = [
        {"RekognitionId": {"S": "CLASS#c1"}, "Type": {"S": "Class"}, "ClassId": {"S": "c1"}, "ClassName": {"S": "Redes"},
         "TeacherEmail": {"S": "doc@umb.edu.co"}},
        {"RekognitionId": {"S": "ENROLL#c1#ana"}, "Type": {"S": "Enrollment"}, "ClassId": {"S": "c1"},
         "StudentEmail": {"S": "ana@academia.umb.edu.co"}, "StudentName": {"S": "Ana"}},
        {"RekognitionId": {"S": "ATTSESSION#c1_2026-09-28"}, "Type": {"S": "AttendanceSession"}, "ClassId": {"S": "c1"},
         "SessionDate": {"S": "2026-09-28"}},
        {"RekognitionId": {"S": "ATTEND#s#ana"}, "Type": {"S": "Attendance"}, "ClassId": {"S": "c1"}, "Status": {"S": "retardo"}},
        {"RekognitionId": {"S": "ATTEND#s#leo"}, "Type": {"S": "Attendance"}, "ClassId": {"S": "c1"}, "Status": {"S": "inasistencia"}},
        _TEACHER_PENDING,
    ]
    with patch.object(runtime, "dynamodb", _fake_table(rows)):
        data = _body(lambda_handler(_admin_event("/Prod/admin-classes", {}), None))
    (cls,) = data["classes"]
    assert cls["teacherName"] == "Doc"
    assert cls["studentsCount"] == 1 and cls["sessionsCount"] == 1
    assert cls["lastSessionDate"] == "2026-09-28"
    assert cls["attendance"]["rate"] == 50


def test_admin_classes_requires_admin():
    resp = lambda_handler(_event("/Prod/admin-classes", body={}), None)
    assert resp["statusCode"] == 401


def test_justification_file_types_are_checked_by_content():
    from routes.justifications import _justification_file

    pdf = b"%PDF-1.7 contenido"
    assert _justification_file(pdf, "excusa medica.pdf")[0] == ("pdf", "application/pdf", "excusa medica.pdf")
    docx = b"PK\x03\x04" + b"\x00" * 20 + b"word/document.xml"
    assert _justification_file(docx, "carta.docx")[0][0] == "docx"
    jpg = b"\xff\xd8\xff\xe0" + b"\x00" * 20
    assert _justification_file(jpg, "")[0] == ("jpg", "image/jpeg", "soporte.jpg")
    # Extensión que no corresponde al contenido, o formato no permitido.
    assert _justification_file(pdf, "foto.jpg")[0] is None
    assert _justification_file(b"MZ\x90\x00 ejecutable", "virus.pdf")[0] is None
    assert _justification_file(b"PK\x03\x04" + b"\x00" * 40, "comprimido.docx")[0] is None


def test_server_errors_hide_details():
    from runtime import _response

    body = json.loads(_response(500, {"error": "DynamoDBGetFailed", "details": "secreto interno"})["body"])
    assert body == {"error": "DynamoDBGetFailed"}
    body = json.loads(_response(400, {"error": "X", "details": "ok"})["body"])
    assert body["details"] == "ok"


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in tests:
        fn()
        print("OK", fn.__name__)
    print("all passed")
