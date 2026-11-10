"""Test harness: a real PostgreSQL database built by running the Alembic migrations, a temp-dir
storage backend, and a fake Gemini transport. Set TEST_DATABASE_URL to point at your server."""

import json
import os
import uuid
from datetime import UTC, datetime

import httpx
import pytest
from sqlalchemy import create_engine, text

TEST_DB_URL = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://vgyan:vgyan@localhost:5433/vgyan_test")

os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["ENV"] = "test"
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 32
os.environ["GEMINI_API_KEY"] = "test-key"
os.environ["STORAGE_BACKEND"] = "local"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["PUBLIC_BASE_URL"] = "http://testserver"


def _ensure_database() -> None:
    base, name = TEST_DB_URL.rsplit("/", 1)
    admin = create_engine(base + "/postgres", isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        if not c.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": name}).scalar():
            c.execute(text(f'CREATE DATABASE "{name}"'))
    admin.dispose()


@pytest.fixture(scope="session", autouse=True)
def _database(tmp_path_factory):
    os.environ["LOCAL_STORAGE_DIR"] = str(tmp_path_factory.mktemp("storage"))
    from app.core.config import get_settings

    get_settings.cache_clear()
    _ensure_database()
    from alembic.config import Config

    from alembic import command

    eng = create_engine(TEST_DB_URL)
    with eng.begin() as c:
        c.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    eng.dispose()
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
    command.upgrade(cfg, "head")
    yield


TABLES = [
    "audit_log",
    "research_exports",
    "deletion_requests",
    "teacher_comments",
    "record_revisions",
    "ai_assessments",
    "writing_attempts",
    "ocr_records",
    "reading_attempts",
    "sessions",
    "consent_records",
    "assignments",
    "students",
    "teacher_classes",
    "staff_users",
    "classes",
    "schools",
]


@pytest.fixture(autouse=True)
def _clean():
    from app.core.ratelimit import limiter
    from app.db import get_engine
    from app.services.storage import reset_storage

    reset_storage()
    limiter.reset()
    from sqlalchemy.dialects.postgresql import insert

    from app.models import Passage
    from app.seed_data import rows

    with get_engine().begin() as c:
        c.execute(text("TRUNCATE " + ", ".join(TABLES) + ", passages RESTART IDENTITY CASCADE"))
        c.execute(insert(Passage).values(rows()).on_conflict_do_nothing())
    yield


class FakeGemini:
    """Queue of canned Gemini responses; records request bodies."""

    def __init__(self):
        self.responses: list = []
        self.requests: list[dict] = []

    def push_json(self, obj: dict, model_version: str = "gemini-2.5-flash-test"):
        self.responses.append(
            httpx.Response(
                200,
                json={
                    "candidates": [{"content": {"parts": [{"text": json.dumps(obj, ensure_ascii=False)}]}}],
                    "modelVersion": model_version,
                },
            )
        )

    def push_text(self, txt: str):
        self.responses.append(
            httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": txt}]}}], "modelVersion": "gemini-test"})
        )

    def push_status(self, code: int):
        self.responses.append(httpx.Response(code, json={"error": {"message": "x"}}))

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(json.loads(request.content))
        if not self.responses:
            return httpx.Response(500, json={"error": "no fake response queued"})
        return self.responses.pop(0)


@pytest.fixture
def fake_gemini(monkeypatch):
    from app.services import gemini

    fake = FakeGemini()
    gemini.set_transport(httpx.MockTransport(fake.handler))
    monkeypatch.setattr("time.sleep", lambda *_: None)
    yield fake
    gemini.set_transport(None)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c


# ---------- builders ----------


def register(client, pid="VG-2026-100001", password="secret123", name="Asha K", email=None, class_code=None):
    body = {"student_id": pid, "fullName": name, "password": password}
    if email:
        body["email"] = email
    if class_code:
        body["classCode"] = class_code
    r = client.post("/student/register", json=body)
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def consent_record(pid="VG-2026-100001", status="active", audio=True, handwriting=True, research=True, cid=None, version="1.0"):
    return {
        "id": cid or str(uuid.uuid4()),
        "participantId": pid,
        "consentVersion": version,
        "acceptedAt": datetime.now(UTC).isoformat(),
        "withdrawnAt": None if status == "active" else datetime.now(UTC).isoformat(),
        "signerType": "guardian",
        "signerName": "Parent Name",
        "signerRelation": "Mother",
        "language": "kn",
        "audioConsent": audio,
        "handwritingConsent": handwriting,
        "researchConsent": research,
        "status": status,
    }


def give_consent(client, headers, **kw):
    r = client.post("/sync/consent", data={"record": json.dumps(consent_record(**kw))}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def reading_record(pid="VG-2026-100001", rid=None, **over):
    sid = str(uuid.uuid5(uuid.NAMESPACE_OID, pid))  # one device session per participant
    rec = {
        "id": rid or str(uuid.uuid4()),
        "participantId": pid,
        "sessionId": sid,
        "session": {
            "sessionId": sid,
            "participantId": pid,
            "appVersion": "1.0.0",
            "deviceInfo": "Test Phone Android 14",
            "startedAt": datetime.now(UTC).isoformat(),
        },
        "passageId": "P-EN-E1",
        "title": "My Pet Cat",
        "kannadaTitle": "ನನ್ನ ಸಾಕು ಬೆಕ್ಕು",
        "language": "English",
        "level": "Easy",
        "createdAt": datetime.now(UTC).isoformat(),
        "referenceText": "The boy went to school.",
        "transcript": "The boy go to school",
        "audioUri": "file:///data/recordings/x.wav",
        "durationSec": 60,
        "asrConfidence": 0.91,
        "asrModelVersion": "vosk-small-en-in-0.4",
        "accuracy": 80,
        "wpm": 5,
        "wcpm": 4,
        "pace": "Slow",
        "mistakesCount": 1,
        "substitutions": 1,
        "omissions": 0,
        "insertions": 0,
        "practiceWords": ["went"],
        "words": [
            {"status": "correct", "ref": "The", "hyp": "The"},
            {"status": "correct", "ref": "boy", "hyp": "boy"},
            {"status": "substitution", "ref": "went", "hyp": "go"},
            {"status": "correct", "ref": "to", "hyp": "to"},
            {"status": "correct", "ref": "school.", "hyp": "school"},
        ],
        "aiStatus": "pending",
        "synced": False,
    }
    rec.update(over)
    return rec


def writing_record(pid="VG-2026-100001", wid=None, **over):
    rec = {
        "id": wid or str(uuid.uuid4()),
        "participantId": pid,
        "sessionId": None,
        "promptId": "W-EN-1",
        "prompt": "Describe your favorite festival.",
        "kannadaPrompt": "",
        "language": "English",
        "createdAt": datetime.now(UTC).isoformat(),
        "inputMethod": "camera",
        "imageUri": "file:///img.jpg",
        "originalOcr": "My favrite festival is Diwali.",
        "ocrConfidence": None,
        "correctedText": "My favourite festival is Diwali.",
        "wordCount": 5,
        "sentenceCount": 1,
        "score": 0,
        "grammarScore": 0,
        "vocabularyScore": 0,
        "spellingScore": 0,
        "aiStatus": "pending",
        "synced": False,
    }
    rec.update(over)
    return rec


def wav_bytes(seconds: float = 0.5) -> bytes:
    import io
    import wave

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"\x00\x00" * int(16000 * seconds))
    return buf.getvalue()


def jpeg_bytes() -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (40, 30), "white").save(buf, format="JPEG")
    return buf.getvalue()


def make_staff(role="teacher", email=None, password="teacher-pass-123", class_ids=()):
    from app.core.security import hash_password
    from app.db import session_factory
    from app.models import StaffUser, TeacherClass

    with session_factory()() as db:
        u = StaffUser(
            email=email or f"{role}-{uuid.uuid4().hex[:6]}@school.test",
            full_name=f"{role.title()} One",
            password_hash=hash_password(password),
            role=role,
        )
        db.add(u)
        db.flush()
        for cid in class_ids:
            db.add(TeacherClass(staff_id=u.id, class_id=cid))
        db.commit()
        return u.email, password


def make_class(grade=4, section="A", school="Govt HPS Dharwad"):
    from app.db import session_factory
    from app.models import ClassGroup, School

    with session_factory()() as db:
        s = School(name=school)
        db.add(s)
        db.flush()
        code = uuid.uuid4().hex[:6].upper()
        c = ClassGroup(school_id=s.id, grade=grade, section=section, join_code=code)
        db.add(c)
        db.commit()
        return c.id, code


def staff_headers(client, email, password):
    r = client.post("/auth/staff/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
