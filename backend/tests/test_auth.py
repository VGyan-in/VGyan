from tests.conftest import make_class, make_staff, register, staff_headers


def test_register_login_and_profile(client):
    h = register(client, pid="vg-2026-100001", email="Asha@Example.org")
    me = client.get("/student/me", headers=h).json()
    assert me["participantId"] == "VG-2026-100001"  # normalised to upper case
    assert me["email"] == "asha@example.org"

    r = client.post("/student/login", json={"student_id": "VG-2026-100001", "password": "secret123"})
    assert r.status_code == 200 and r.json()["participant_id"] == "VG-2026-100001"
    # e-mail also works as the identifier
    assert client.post("/student/login", json={"student_id": "asha@example.org", "password": "secret123"}).status_code == 200


def test_register_generates_participant_id_when_missing(client):
    r = client.post("/student/register", json={"fullName": "Ravi", "password": "secret123"})
    assert r.status_code == 201
    assert r.json()["participant_id"].startswith("VG-")


def test_duplicate_participant_and_email(client):
    register(client, pid="VG-1", email="a@b.org")
    r = client.post("/student/register", json={"student_id": "VG-1", "fullName": "X", "password": "secret123"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "participant_exists"
    r = client.post("/student/register", json={"student_id": "VG-2", "fullName": "X", "password": "secret123", "email": "A@B.org"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "email_exists"


def test_login_errors_match_app_expectations(client):
    register(client, pid="VG-1")
    assert client.post("/student/login", json={"student_id": "VG-1", "password": "nope"}).status_code == 401
    assert client.post("/student/login", json={"student_id": "VG-404", "password": "nope"}).status_code == 404


def test_validation_errors_never_echo_input(client):
    r = client.post("/student/register", json={"student_id": "VG-1", "fullName": "Secret Name", "password": "x"})
    assert r.status_code == 422
    assert "Secret Name" not in r.text and r.json()["error"]["code"] == "validation_error"


def test_password_is_hashed_with_argon2(client):
    register(client, pid="VG-1")
    from app.db import session_factory
    from app.models import Student

    with session_factory()() as db:
        s = db.query(Student).one()
        assert s.password_hash.startswith("$argon2id$") and "secret123" not in s.password_hash


def test_class_code_links_student(client):
    cid, code = make_class()
    h = register(client, pid="VG-1")
    bad = client.patch("/student/me", json={"classCode": "NOPE99"}, headers=h)
    assert bad.status_code == 422
    r = client.patch("/student/me", json={"classCode": code.lower(), "grade": "4", "section": "A", "school": "Govt HPS"}, headers=h)
    assert r.status_code == 200
    assert r.json()["classId"] == str(cid) and r.json()["grade"] == "4"


def test_logout_all_revokes_tokens(client):
    h = register(client, pid="VG-1")
    assert client.post("/student/logout-all", headers=h).status_code == 204
    assert client.get("/student/me", headers=h).status_code == 401


def test_missing_and_garbage_tokens(client):
    assert client.get("/student/me").status_code == 401
    assert client.get("/student/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_student_token_cannot_reach_staff_routes(client):
    h = register(client, pid="VG-1")
    assert client.get("/teacher/students", headers=h).status_code == 403
    assert client.get("/research/export", headers=h).status_code == 403


def test_staff_login_and_roles(client):
    email, pw = make_staff("researcher")
    h = staff_headers(client, email, pw)
    assert client.get("/teacher/students", headers=h).status_code == 403  # researchers get no named records
    assert client.get("/research/summary", headers=h).status_code == 200
    assert client.post("/auth/staff/login", json={"email": email, "password": "wrong"}).status_code == 401
    assert client.post("/admin/schools", json={"name": "X School"}, headers=h).status_code == 403


def test_rate_limit_on_login(client, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    register(client, pid="VG-1")
    codes = [client.post("/student/login", json={"student_id": "VG-1", "password": "bad"}).status_code for _ in range(12)]
    assert 429 in codes


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"
    r = client.get("/health/ready")
    assert r.status_code == 200
    assert r.json()["checks"]["database"]["migration"] == "0002"


def test_assignments_include_seeded_passages(client):
    h = register(client, pid="VG-1")
    ids = {p["id"] for p in client.get("/student/assignments", headers=h).json()["passages"]}
    assert {"P-EN-E1", "P-KN-A1", "W-KN-2"} <= ids
