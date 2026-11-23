import csv
import io
import json

from tests.conftest import (
    give_consent,
    make_class,
    make_staff,
    reading_record,
    register,
    staff_headers,
    wav_bytes,
    writing_record,
)


def _setup(client):
    """Two classes, one student in each, a teacher assigned to class A only."""
    cid_a, code_a = make_class(4, "A", "School A")
    cid_b, code_b = make_class(5, "B", "School B")
    ha = register(client, pid="VG-A1", name="Student In A", class_code=code_a)
    hb = register(client, pid="VG-B1", name="Student In B", class_code=code_b)
    for pid, h in (("VG-A1", ha), ("VG-B1", hb)):
        give_consent(client, h, pid=pid)
        r = client.post(
            "/sync/reading",
            data={"record": json.dumps(reading_record(pid=pid))},
            files={"file": ("a.wav", wav_bytes(), "audio/wav")},
            headers=h,
        )
        assert r.status_code == 200, r.text
    email, pw = make_staff("teacher", class_ids=[cid_a])
    return {"cid_a": cid_a, "cid_b": cid_b, "ha": ha, "hb": hb, "th": staff_headers(client, email, pw)}


def test_teacher_sees_only_assigned_classes(client):
    s = _setup(client)
    me = client.get("/teacher/me", headers=s["th"]).json()
    assert [c["id"] for c in me["assignedClasses"]] == [str(s["cid_a"])]
    assert me["assignedClasses"][0]["studentCount"] == 1

    students = client.get("/teacher/students", headers=s["th"]).json()
    assert [x["participantId"] for x in students] == ["VG-A1"]
    st = students[0]
    assert st["consentStatus"] == "active" and st["consentCurrent"] is True
    assert st["recentReadingAttempts"][0]["words"][2] == {"status": "substitution", "ref": "went", "hyp": "go"}

    other = client.get("/teacher/me", headers=s["hb"])  # student token
    assert other.status_code == 403


def test_teacher_cannot_open_other_class_records(client):
    s = _setup(client)
    admin_email, admin_pw = make_staff("admin")
    ah = staff_headers(client, admin_email, admin_pw)
    all_students = client.get("/teacher/students", headers=ah).json()
    assert {x["participantId"] for x in all_students} == {"VG-A1", "VG-B1"}
    b = next(x for x in all_students if x["participantId"] == "VG-B1")
    b_attempt = b["recentReadingAttempts"][0]["id"]

    assert client.get(f"/teacher/students/{b['studentId']}", headers=s["th"]).status_code == 404
    assert client.get(f"/teacher/reading/{b_attempt}/audio", headers=s["th"]).status_code == 404
    r = client.post("/teacher/comments", json={"studentId": b["studentId"], "text": "x", "category": "General"}, headers=s["th"])
    assert r.status_code == 404


def test_signed_audio_url_works_and_is_audited(client):
    s = _setup(client)
    a = client.get("/teacher/students", headers=s["th"]).json()[0]
    attempt = a["recentReadingAttempts"][0]
    assert attempt["hasAudio"] is True
    r = client.get(f"/teacher/reading/{attempt['id']}/audio", headers=s["th"])
    assert r.status_code == 200
    url = r.json()["url"]
    f = client.get(url.replace("http://testserver", ""))
    assert f.status_code == 200 and f.content[:4] == b"RIFF" and f.headers["cache-control"] == "private, no-store"
    assert client.get("/files/not-a-token").status_code == 403

    from app.db import session_factory
    from app.models import AuditLog

    with session_factory()() as db:
        assert db.query(AuditLog).filter_by(action="media.audio_url").count() == 1


def test_comments_missed_words_and_analytics(client):
    s = _setup(client)
    sid = client.get("/teacher/students", headers=s["th"]).json()[0]["studentId"]
    r = client.post("/teacher/comments", json={"studentId": sid, "text": "Practise 'went'", "category": "Intervention"}, headers=s["th"])
    assert r.status_code == 201
    assert client.get("/teacher/comments", headers=s["th"]).json()[0]["text"] == "Practise 'went'"

    mw = client.get("/teacher/missed-words", headers=s["th"]).json()
    assert mw[0]["word"] == "went" and mw[0]["commonSubstitutions"] == ["go"] and mw[0]["affectedStudentsCount"] == 1

    an = client.get("/teacher/analytics", headers=s["th"]).json()
    assert an["students"] == 1 and an["completion"]["readingAny"] == 1 and an["byLanguageLevel"][0]["avgAccuracy"] == 80


def test_passages_and_assignments(client):
    s = _setup(client)
    p = {"id": "P-EN-E2", "kind": "reading", "language": "English", "level": "Easy", "title": "Rain", "text": "It is raining today."}
    assert client.post("/passages", json=p, headers=s["th"]).status_code == 201
    upd = client.put("/passages/P-EN-E2", json={**p, "text": "It rained today."}, headers=s["th"]).json()
    assert upd["version"] == 2
    assert client.post("/assignments", json={"passageId": "P-EN-E2", "classId": str(s["cid_a"])}, headers=s["th"]).status_code == 201
    # not this teacher's class
    assert client.post("/assignments", json={"passageId": "P-EN-E2", "classId": str(s["cid_b"])}, headers=s["th"]).status_code == 404
    mine = client.get("/student/assignments", headers=s["ha"]).json()["passages"]
    assert next(x for x in mine if x["id"] == "P-EN-E2")["assigned"] is True
    theirs = client.get("/student/assignments", headers=s["hb"]).json()["passages"]
    assert next(x for x in theirs if x["id"] == "P-EN-E2")["assigned"] is False


def test_research_export_is_deidentified_and_consent_filtered(client):
    s = _setup(client)
    # A third student withdraws consent: their data must not appear.
    hc = register(client, pid="VG-C1", name="Withdrawn Kid")
    import uuid as _uuid

    cid = str(_uuid.uuid4())
    give_consent(client, hc, pid="VG-C1", cid=cid)
    client.post("/sync/reading", data={"record": json.dumps(reading_record(pid="VG-C1"))}, headers=hc)
    give_consent(client, hc, pid="VG-C1", cid=cid, status="withdrawn")

    email, pw = make_staff("researcher")
    rh = staff_headers(client, email, pw)
    r = client.get("/research/export?dataset=reading", headers=rh)
    assert r.status_code == 200
    text = r.content.decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text)))
    assert {row["participant_id"] for row in rows} == {"VG-A1", "VG-B1"}
    for banned in ("Student In A", "Withdrawn Kid", "Parent Name", "School A"):
        assert banned not in text
    assert rows[0]["metrics_verified"] == "True" and r.headers["x-content-sha256"]

    parts = list(csv.DictReader(io.StringIO(client.get("/research/export?dataset=participants", headers=rh).content.decode("utf-8-sig"))))
    assert "school" not in parts[0] and len(parts) == 2

    # teachers cannot export
    assert client.get("/research/export", headers=s["th"]).status_code == 403


def test_writing_details_for_teacher(client):
    s = _setup(client)
    rec = writing_record(pid="VG-A1", inputMethod="typed", originalOcr=None, imageUri=None)
    assert client.post("/sync/writing", data={"record": json.dumps(rec)}, headers=s["ha"]).status_code == 200
    st = client.get("/teacher/students", headers=s["th"]).json()[0]
    w = st["recentWritingAttempts"][0]
    assert w["studentCorrectedText"] == rec["correctedText"] and w["rawOcrText"] is None and w["hasImage"] is False


def test_admin_setup_and_deletion_workflow(client):
    admin_email, admin_pw = make_staff("admin")
    ah = staff_headers(client, admin_email, admin_pw)
    school = client.post("/admin/schools", json={"name": "GHPS Dharwad"}, headers=ah).json()
    cls = client.post("/admin/classes", json={"schoolId": school["id"], "grade": 3, "section": "a"}, headers=ah).json()
    assert cls["section"] == "A" and len(cls["joinCode"]) == 6
    t = client.post(
        "/admin/staff",
        json={"email": "T@x.org", "fullName": "Teacher T", "password": "a-long-password", "role": "teacher", "classIds": [cls["id"]]},
        headers=ah,
    )
    assert t.status_code == 201
    th = staff_headers(client, "t@x.org", "a-long-password")

    h = register(client, pid="VG-D1", class_code=cls["joinCode"])
    give_consent(client, h, pid="VG-D1")
    client.post(
        "/sync/reading",
        data={"record": json.dumps(reading_record(pid="VG-D1"))},
        files={"file": ("a.wav", wav_bytes(), "audio/wav")},
        headers=h,
    )
    assert len(client.get("/teacher/students", headers=th).json()) == 1

    req = client.post("/student/me/deletion-request", json={"reason": "Parent asked"}, headers=h).json()
    assert req["status"] == "pending"
    lst = client.get("/admin/deletion-requests", headers=ah).json()
    assert lst[0]["participantId"] == "VG-D1"
    done = client.post(f"/admin/deletion-requests/{req['id']}", json={"action": "complete"}, headers=ah).json()
    assert done["status"] == "completed" and done["deleted"]["reading_attempts"] == 1 and done["filesDeleted"] == 1

    assert client.get("/teacher/students", headers=th).json() == []
    assert client.get("/student/me", headers=h).status_code == 401
    from app.db import session_factory
    from app.models import ConsentRecord

    with session_factory()() as db:
        c = db.query(ConsentRecord).one()
        assert c.signer_name == "[deleted]" and c.status == "withdrawn"  # evidence kept, PII removed
