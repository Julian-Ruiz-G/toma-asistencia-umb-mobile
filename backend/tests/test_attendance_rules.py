"""Reglas de estado de /confirm-attendance-photo y matching de rostros contra el roster.

Rekognition se simula con botocore.stub.Stubber (valida también los parámetros de cada llamada).
DynamoDB se simula con una tabla en memoria para revisar el estado final de cada registro.
"""
from __future__ import annotations

import base64
import calendar
import io
import json
import os
import re
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))
os.environ.setdefault("AUTH_SECRET", "test-secret-no-usar-en-produccion")

boto3 = pytest.importorskip("boto3")
from botocore.stub import ANY, Stubber  # noqa: E402
from PIL import Image  # noqa: E402

import runtime  # noqa: E402
from lambda_handler import lambda_handler  # noqa: E402
from routes import attendance as attendance_routes  # noqa: E402

# 2026-09-30 10:00 hora Colombia (15:00 UTC): dentro de la ventana para tomar la foto.
NOW = calendar.timegm((2026, 9, 30, 15, 0, 0))
TEACHER = "docente1@umb.edu.co"
CLASS_ID = "123456-123_A1"
SESSION_ID = f"{CLASS_ID}_2026-09-30"
ANA, LUIS, EVA, INTRUSO = (
    "ana@academia.umb.edu.co",
    "luis@academia.umb.edu.co",
    "eva@academia.umb.edu.co",
    "intruso@academia.umb.edu.co",
)
FACE_OF = {ANA: "face-ana", LUIS: "face-luis", EVA: "face-eva", INTRUSO: "face-intruso"}


# --------------------------------------------------------------------------- utilidades


class FakeDynamo:
    """Tabla en memoria con la API mínima que usa el backend."""

    def __init__(self, items):
        self.items = {it["RekognitionId"]["S"]: dict(it) for it in items}
        self.updates = []

    def get_item(self, TableName=None, Key=None, **_):
        it = self.items.get(Key["RekognitionId"]["S"])
        return {"Item": dict(it)} if it else {}

    def put_item(self, TableName=None, Item=None, ConditionExpression=None, **_):
        pk = Item["RekognitionId"]["S"]
        if ConditionExpression == "attribute_not_exists(RekognitionId)" and pk in self.items:
            raise Exception("ConditionalCheckFailedException")
        self.items[pk] = dict(Item)
        return {}

    def update_item(self, **kwargs):
        self.updates.append(kwargs)
        return {}

    def delete_item(self, TableName=None, Key=None, **_):
        self.items.pop(Key["RekognitionId"]["S"], None)
        return {}

    def scan(self, FilterExpression="", ExpressionAttributeNames=None, ExpressionAttributeValues=None, **_):
        names = ExpressionAttributeNames or {}
        values = ExpressionAttributeValues or {}
        pairs = re.findall(r"(#\w+)\s*=\s*(:\w+)", FilterExpression or "")
        use_or = " OR " in (FilterExpression or "")

        def matches(it):
            checks = [(it.get(names[n]) or {}).get("S") == values[v].get("S") for n, v in pairs]
            return any(checks) if use_or else all(checks)

        return {"Items": [dict(i) for i in self.items.values() if matches(i)]}

    def attendance(self, email):
        return self.items.get(f"ATTEND#{SESSION_ID}#{email}".lower())

    def status(self, email):
        it = self.attendance(email)
        return (it or {}).get("Status", {}).get("S")


def _photo_b64() -> str:
    buf = io.BytesIO()
    Image.new("RGB", (800, 600), (200, 200, 200)).save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode()


def _face(i):
    return {"BoundingBox": {"Left": 0.05 + 0.3 * i, "Top": 0.2, "Width": 0.2, "Height": 0.3}, "Confidence": 99.5}


def _match(email, similarity):
    return {"Similarity": similarity, "Face": {"FaceId": FACE_OF[email], "Confidence": 99.0}}


def _table(roster, records=None, scheduled_start=NOW - 600, late_after=900, extra=()):
    """roster: correos matriculados. records: {correo: (Status, Method)} previos (QR, justificación...)."""
    items = [
        {"RekognitionId": {"S": f"CLASS#{CLASS_ID}"}, "Type": {"S": "Class"}, "ClassId": {"S": CLASS_ID},
         "ClassName": {"S": "Álgebra"}, "TeacherEmail": {"S": TEACHER}},
        {"RekognitionId": {"S": f"ATTSESSION#{SESSION_ID}"}, "Type": {"S": "AttendanceSession"},
         "ClassId": {"S": CLASS_ID}, "ScheduledStartEpoch": {"N": str(scheduled_start)},
         "LateAfterSeconds": {"N": str(late_after)}},
    ]
    for email, face_id in FACE_OF.items():
        items.append({"RekognitionId": {"S": face_id}, "Role": {"S": "student"}, "Email": {"S": email},
                      "FullName": {"S": email.split("@")[0].title()}})
    for email in roster:
        items.append({"RekognitionId": {"S": f"ENROLL#{CLASS_ID}#{email}"}, "Type": {"S": "Enrollment"},
                      "ClassId": {"S": CLASS_ID}, "StudentEmail": {"S": email}})
    for email, (status, method) in (records or {}).items():
        items.append({"RekognitionId": {"S": f"ATTEND#{SESSION_ID}#{email}".lower()}, "Type": {"S": "Attendance"},
                      "SessionId": {"S": SESSION_ID}, "ClassId": {"S": CLASS_ID}, "StudentEmail": {"S": email},
                      "Status": {"S": status}, "Method": {"S": method}, "MarkedAt": {"N": str(NOW - 300)}})
    items.extend(extra)
    return FakeDynamo(items)


def _rekognition(face_count, matches_per_face):
    """Cliente real de boto3 con Stubber: detect_faces y luego una búsqueda por rostro, en orden."""
    client = boto3.client("rekognition", region_name="us-east-2",
                          aws_access_key_id="test", aws_secret_access_key="test")
    stub = Stubber(client)
    stub.add_response(
        "detect_faces",
        {"FaceDetails": [_face(i) for i in range(face_count)]},
        {"Image": {"Bytes": ANY}, "Attributes": ["DEFAULT"]},
    )
    for matches in matches_per_face:
        stub.add_response(
            "search_faces_by_image",
            {"FaceMatches": matches},
            {"CollectionId": runtime.COLLECTION, "Image": {"Bytes": ANY},
             "FaceMatchThreshold": runtime.FACE_MATCH_THRESHOLD, "MaxFaces": runtime.MAX_MATCHES},
        )
    stub.activate()
    return client, stub


def _confirm(table, rek_client):
    token = runtime._sign_token({"sub": TEACHER, "role": "teacher", "iat": NOW, "exp": NOW + 3600})
    event = {
        "httpMethod": "POST",
        "path": "/Prod/confirm-attendance-photo",
        "requestContext": {"http": {"method": "POST", "path": "/Prod/confirm-attendance-photo"}},
        "headers": {"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        "body": json.dumps({"sessionId": SESSION_ID, "imageBase64": _photo_b64()}),
        "isBase64Encoded": False,
    }
    with patch("time.time", return_value=NOW), \
            patch.object(runtime, "dynamodb", table), patch.object(attendance_routes, "dynamodb", table), \
            patch.object(runtime, "rekognition", rek_client), patch.object(attendance_routes, "rekognition", rek_client):
        resp = lambda_handler(event, None)
    return resp["statusCode"], json.loads(resp["body"])


# --------------------------------------------------------------------------- reglas de estado


def test_presente_en_foto_sin_qr_queda_asistencia_a_tiempo():
    table = _table([ANA])
    rek, stub = _rekognition(1, [[_match(ANA, 99.0)]])
    code, body = _confirm(table, rek)
    stub.assert_no_pending_responses()
    assert code == 200
    assert table.status(ANA) == "asistencia"
    assert table.attendance(ANA)["Method"]["S"] == "face"
    assert table.attendance(ANA)["PresentInPhoto"]["BOOL"] is True


def test_presente_en_foto_despues_del_limite_queda_retardo():
    # La clase empezó hace 40 min y el retardo cuenta desde los 15.
    table = _table([ANA], scheduled_start=NOW - 2400, late_after=900)
    rek, _ = _rekognition(1, [[_match(ANA, 99.0)]])
    code, _ = _confirm(table, rek)
    assert code == 200
    assert table.status(ANA) == "retardo"


def test_qr_asistencia_y_en_foto_conserva_asistencia():
    table = _table([ANA], records={ANA: ("asistencia", "qr")}, scheduled_start=NOW - 2400)
    rek, _ = _rekognition(1, [[_match(ANA, 99.0)]])
    _confirm(table, rek)
    # Aunque la foto sea tarde, se respeta la hora en que marcó con el QR.
    assert table.status(ANA) == "asistencia"


def test_qr_retardo_y_en_foto_conserva_retardo():
    table = _table([ANA], records={ANA: ("retardo", "qr")})
    rek, _ = _rekognition(1, [[_match(ANA, 99.0)]])
    _confirm(table, rek)
    assert table.status(ANA) == "retardo"


def test_qr_sin_estar_en_foto_baja_a_inasistencia():
    # Ana marcó con QR pero no aparece en la foto (QR reenviado); Luis sí aparece.
    table = _table([ANA, LUIS], records={ANA: ("asistencia", "qr")})
    rek, _ = _rekognition(2, [[_match(LUIS, 99.0)], []])
    code, body = _confirm(table, rek)
    assert code == 200
    assert table.status(ANA) == "inasistencia"
    assert table.attendance(ANA)["PresentInPhoto"]["BOOL"] is False
    assert table.status(LUIS) == "asistencia"
    assert body["downgradedToInasistencia"] >= 1


def test_sin_qr_y_sin_foto_queda_inasistencia():
    table = _table([ANA, EVA])
    rek, _ = _rekognition(1, [[_match(ANA, 99.0)]])
    _confirm(table, rek)
    assert table.status(EVA) == "inasistencia"
    assert table.attendance(EVA)["Method"]["S"] == "photo"


def test_justificada_se_mantiene_aunque_no_salga_en_la_foto():
    table = _table([ANA, EVA], records={EVA: ("justificada", "justification")})
    rek, _ = _rekognition(1, [[_match(ANA, 99.0)]])
    _confirm(table, rek)
    # Regla actual: una falta justificada cuenta como asistencia y no se baja a inasistencia.
    assert table.status(EVA) == "asistencia"
    assert table.attendance(EVA)["Method"]["S"] == "justification"


def test_un_rostro_sin_identificar_no_baja_los_estados_del_qr():
    # Protección: foto con 1 rostro que Rekognition no reconoce -> no se castiga a quien marcó QR.
    table = _table([ANA, LUIS], records={ANA: ("asistencia", "qr"), LUIS: ("retardo", "qr")})
    rek, _ = _rekognition(1, [[]])
    code, body = _confirm(table, rek)
    assert code == 200
    assert table.status(ANA) == "asistencia"
    assert table.status(LUIS) == "retardo"
    assert body["presentCount"] == 0


def test_la_sesion_queda_bloqueada_con_las_cifras_de_la_foto():
    table = _table([ANA, LUIS])
    rek, _ = _rekognition(3, [[_match(ANA, 99.0)], [_match(LUIS, 98.0)], []])
    code, body = _confirm(table, rek)
    assert code == 200
    assert body["facesDetected"] == 3 and body["presentCount"] == 2
    lock = next(u for u in table.updates if u["Key"]["RekognitionId"]["S"] == f"ATTSESSION#{SESSION_ID}")
    vals = lock["ExpressionAttributeValues"]
    assert vals[":pf"] == {"N": "3"} and vals[":pr"] == {"N": "2"} and vals[":pu"] == {"N": "1"}
    assert ":pc" in vals  # PhotoConfirmedAt: el QR ya no puede cambiar estados.


# --------------------------------------------------------------------------- matching contra el roster


def test_busca_cada_rostro_con_los_parametros_configurados():
    # Stubber falla si CollectionId, FaceMatchThreshold o MaxFaces no coinciden con la configuración.
    table = _table([ANA, LUIS])
    rek, stub = _rekognition(2, [[_match(ANA, 97.0)], [_match(LUIS, 96.0)]])
    code, body = _confirm(table, rek)
    stub.assert_no_pending_responses()  # una búsqueda por rostro, ni más ni menos
    assert code == 200 and body["presentCount"] == 2


def test_elige_el_match_de_mayor_similitud():
    table = _table([ANA, LUIS])
    # Rekognition puede devolver varias coincidencias; debe ganar la de mayor similitud (Luis).
    rek, _ = _rekognition(1, [[_match(ANA, 86.0), _match(LUIS, 99.5)]])
    _confirm(table, rek)
    assert table.attendance(LUIS)["PresentInPhoto"]["BOOL"] is True
    assert table.attendance(ANA)["PresentInPhoto"]["BOOL"] is False


def test_ignora_rostros_de_personas_fuera_de_la_clase():
    table = _table([ANA])
    rek, _ = _rekognition(2, [[_match(ANA, 99.0)], [_match(INTRUSO, 99.9)]])
    code, body = _confirm(table, rek)
    assert body["presentCount"] == 1
    assert table.attendance(INTRUSO) is None  # no se crea asistencia para quien no está matriculado


def test_mismo_estudiante_en_dos_rostros_cuenta_una_vez():
    table = _table([ANA, LUIS])
    rek, _ = _rekognition(2, [[_match(ANA, 99.0)], [_match(ANA, 91.0)]])
    code, body = _confirm(table, rek)
    assert body["presentCount"] == 1
    assert table.status(LUIS) == "inasistencia"


def test_usa_el_mejor_match_que_si_esta_en_la_clase():
    # Regresión: antes se tomaba el mejor match de TODA la colección y, si no era de la clase,
    # se descartaba el rostro aunque el estudiante matriculado viniera en 2.º lugar.
    table = _table([ANA])
    # Primer candidato: alguien de otra clase (muy parecido); segundo: Ana, que sí está matriculada.
    rek, _ = _rekognition(1, [[_match(INTRUSO, 99.0), _match(ANA, 95.0)]])
    _confirm(table, rek)
    assert table.status(ANA) == "asistencia"


def test_sin_pillow_varias_caras_no_modifica_la_asistencia():
    table = _table([ANA, LUIS], records={ANA: ("asistencia", "qr")})
    before = {k: dict(v) for k, v in table.items.items()}
    rek, _ = _rekognition(2, [])
    with patch.object(runtime, "PIL_AVAILABLE", False), patch.object(attendance_routes, "PIL_AVAILABLE", False):
        code, body = _confirm(table, rek)
    assert code == 503 and body["error"] == "GroupRecognitionUnavailable"
    assert table.items == before  # nada escrito
    assert not table.updates      # la sesión no se bloquea


def test_vista_previa_usa_el_mejor_match_que_si_esta_en_la_clase():
    # Mismo caso en /recognize-class (la vista previa antes de confirmar).
    from routes import recognize as recognize_routes

    table = _table([ANA])
    rek, stub = _rekognition(1, [[_match(INTRUSO, 99.0), _match(ANA, 95.0)]])
    token = runtime._sign_token({"sub": TEACHER, "role": "teacher", "iat": NOW, "exp": NOW + 3600})
    event = {
        "httpMethod": "POST",
        "path": "/Prod/recognize-class",
        "requestContext": {"http": {"method": "POST", "path": "/Prod/recognize-class"}},
        "headers": {"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        "body": json.dumps({"classId": CLASS_ID, "imageBase64": _photo_b64()}),
        "isBase64Encoded": False,
    }
    with patch("time.time", return_value=NOW), \
            patch.object(runtime, "dynamodb", table), patch.object(recognize_routes, "dynamodb", table), \
            patch.object(runtime, "rekognition", rek), patch.object(recognize_routes, "rekognition", rek):
        resp = lambda_handler(event, None)
    body = json.loads(resp["body"])
    stub.assert_no_pending_responses()
    assert resp["statusCode"] == 200
    assert [r["studentEmail"] for r in body["recognized"]] == [ANA]
    assert body["roster"][0]["present"] is True
