import json
import base64
import logging

from runtime import (
    PIL_AVAILABLE,
    _get_path,
    _load_image,
    _bytes_from_pil,
    _response,
)
from routes.auth import (
    handle_register_teacher,
    handle_login_teacher,
    handle_login_admin,
    handle_set_consent,
    handle_update_my_profile,
    handle_login_student,
    handle_captcha_challenge,
    handle_captcha_verify,
    handle_validate_register_photo,
    handle_register,
)
from routes.admin import (
    handle_admin_students,
    handle_admin_students_by_class,
    handle_admin_update_student,
    handle_admin_delete_student,
    handle_admin_teachers,
    handle_admin_update_teacher,
    handle_admin_delete_teacher,
    handle_admin_logs,
    handle_admin_consents,
    handle_admin_create_teacher,
    handle_admin_dashboard_stats,
)
from routes.classes import (
    handle_create_class,
    handle_update_class,
    handle_join_class,
    handle_my_classes,
    handle_class_details,
    handle_regenerate_class_qr,
    handle_remove_student_from_class,
    handle_delete_class,
)
from routes.attendance import (
    handle_create_attendance_qr,
    handle_mark_attendance,
    handle_attendance_details,
    handle_set_attendance_status,
    handle_confirm_attendance_photo,
    handle_attendance_report,
    handle_student_daily_summary,
    handle_student_notifications,
    handle_mark_notifications_read,
    handle_student_attendance_history,
)
from routes.recognize import handle_recognize_class, handle_recognize

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Order matches the original monolith (first /create-class wins).
ROUTE_HANDLERS = [
    ("/register-teacher", handle_register_teacher),
    ("/login-teacher", handle_login_teacher),
    ("/login-admin", handle_login_admin),
    ("/set-consent", handle_set_consent),
    ("/update-my-profile", handle_update_my_profile),
    ("/admin-students-by-class", handle_admin_students_by_class),
    ("/admin-students", handle_admin_students),
    ("/admin-update-student", handle_admin_update_student),
    ("/admin-delete-student", handle_admin_delete_student),
    ("/admin-teachers", handle_admin_teachers),
    ("/admin-update-teacher", handle_admin_update_teacher),
    ("/admin-delete-teacher", handle_admin_delete_teacher),
    ("/admin-logs", handle_admin_logs),
    ("/admin-consents", handle_admin_consents),
    ("/admin-create-teacher", handle_admin_create_teacher),
    ("/admin-dashboard-stats", handle_admin_dashboard_stats),
    ("/login-student", handle_login_student),
    ("/create-class", handle_create_class),
    ("/update-class", handle_update_class),
    ("/create-attendance-qr", handle_create_attendance_qr),
    ("/mark-attendance", handle_mark_attendance),
    ("/attendance-details", handle_attendance_details),
    ("/set-attendance-status", handle_set_attendance_status),
    ("/confirm-attendance-photo", handle_confirm_attendance_photo),
    ("/attendance-report", handle_attendance_report),
    ("/join-class", handle_join_class),
    ("/my-classes", handle_my_classes),
    ("/student-daily-summary", handle_student_daily_summary),
    ("/student-notifications", handle_student_notifications),
    ("/mark-notifications-read", handle_mark_notifications_read),
    ("/student-attendance-history", handle_student_attendance_history),
    ("/class-details", handle_class_details),
    ("/regenerate-class-qr", handle_regenerate_class_qr),
    ("/remove-student-from-class", handle_remove_student_from_class),
    ("/delete-class", handle_delete_class),
    ("/recognize-class", handle_recognize_class),
    ("/captcha-challenge", handle_captcha_challenge),
    ("/captcha-verify", handle_captcha_verify),
]

IMAGE_ROUTES = [
    ("/validate-register-photo", handle_validate_register_photo),
    ("/register", handle_register),
]

ROUTE_SUFFIXES = [s for s, _ in ROUTE_HANDLERS] + [s for s, _ in IMAGE_ROUTES] + ["/recognize"]


def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event, default=str)}")
    logger.info(f"Context: {context}")

    http_method = (event.get("requestContext") or {}).get("http", {}).get("method") or (
        event.get("requestContext") or {}
    ).get("httpMethod")
    path = (event.get("requestContext") or {}).get("http", {}).get("path") or (
        event.get("requestContext") or {}
    ).get("path")

    logger.info(
        f"REQUEST DEBUG: method={http_method}, path={path}, path_type={type(path)}, "
        f"endswith_delete={path.endswith('/delete-class') if path else 'None'}"
    )

    try:
        method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod") or "POST"
    except Exception:
        method = "POST"

    if method == "OPTIONS":
        return _response(200, {"message": "ok"})

    try:
        path = _get_path(event) if isinstance(event, dict) else ""

        body_raw = event.get("body") if isinstance(event, dict) else None
        if body_raw is None:
            body = event if isinstance(event, dict) else {}
        else:
            if event.get("isBase64Encoded"):
                body_raw = base64.b64decode(body_raw).decode("utf-8")
            body = json.loads(body_raw)

        if isinstance(path, str):
            for suffix, handler in ROUTE_HANDLERS:
                if path.endswith(suffix):
                    return handler(event, body)

        image_b64 = body.get("imageBase64") if isinstance(body, dict) else None
        if not image_b64:
            return _response(400, {"error": 'Missing "imageBase64" in request body'})

        if isinstance(image_b64, str) and image_b64.startswith("data:"):
            image_b64 = image_b64.split(",", 1)[1]

        try:
            image_bytes = base64.b64decode(image_b64)
        except Exception as e:
            return _response(400, {"error": "Invalid base64 image", "details": str(e)})

        img = None
        width = None
        height = None
        image_bytes_fixed = image_bytes
        if PIL_AVAILABLE:
            try:
                img = _load_image(image_bytes)
                width, height = img.size
                image_bytes_fixed = _bytes_from_pil(img)
            except Exception:
                img = None
                width = None
                height = None
                image_bytes_fixed = image_bytes

        if isinstance(path, str):
            for suffix, handler in IMAGE_ROUTES:
                if path.endswith(suffix):
                    return handler(event, body, image_bytes_fixed, img, width, height)

        return handle_recognize(event, body, image_bytes_fixed, img, width, height)

    except Exception as e:
        logger.exception("Unhandled error")
        return _response(500, {"error": "InternalServerError", "details": str(e)})
