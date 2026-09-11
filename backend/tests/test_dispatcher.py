"""Contract tests for the Lambda dispatcher (no real AWS calls)."""
from __future__ import annotations

import json
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

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
    "/admin-dashboard-stats",
    "/login-student",
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


def test_create_class_unauthorized():
    resp = lambda_handler(_event("/Prod/create-class", body={"className": "x"}), None)
    assert resp["statusCode"] == 401
    assert _body(resp)["error"] == "Unauthorized"


def test_mark_attendance_unauthorized():
    resp = lambda_handler(_event("/Prod/mark-attendance", body={}), None)
    assert resp["statusCode"] == 401


def test_captcha_challenge_shape():
    resp = lambda_handler(_event("/Prod/captcha-challenge", body={}), None)
    assert resp["statusCode"] == 200
    data = _body(resp)
    assert data.get("ok") is True
    assert "prompt" in data
    assert "options" in data


if __name__ == "__main__":
    tests = [
        test_all_original_suffixes_registered,
        test_options_cors,
        test_recognize_missing_image,
        test_login_student_missing_fields,
        test_login_teacher_missing_fields,
        test_create_class_unauthorized,
        test_mark_attendance_unauthorized,
        test_captcha_challenge_shape,
    ]
    for fn in tests:
        fn()
        print("OK", fn.__name__)
    print("all passed")
