"""End-to-end API journey against a running VGyan backend (local or production smoke test).

    VGYAN_API=http://localhost:8000 VGYAN_ADMIN_EMAIL=... VGYAN_ADMIN_PASSWORD=... python tools/e2e/api_journey.py

It creates its own uniquely named school, class, teacher, researcher and student (prefix E2E-), then
walks the full journey the app and dashboard use. It never touches other records. On a production
server, remove the E2E records afterwards with the admin deletion workflow (the script requests it).

Steps:
 1. admin creates school + class + teacher + researcher
 2. student registers with the class join code
 3. sync blocked until consent (428), then consent synced
 4. offline English reading synced with WAV (server verifies metrics and checksum)
 5. Kannada reading synced as "pending transcription" (no model) and later completed
 6. retry of the same upload is idempotent
 7. typed writing synced; AI feedback requested (skipped if the server has no Gemini key)
 8. teacher sees the student, word-level errors, signed audio URL, analytics, missed words
 9. teacher cannot see a student outside their class
10. researcher downloads a de-identified, consent-filtered export
11. student withdraws consent and requests deletion; admin completes it
"""

import hashlib
import io
import json
import os
import sys
import uuid
import wave
from datetime import UTC, datetime

import httpx

API = os.environ.get("VGYAN_API", "http://localhost:8000").rstrip("/")
ADMIN = (os.environ["VGYAN_ADMIN_EMAIL"], os.environ["VGYAN_ADMIN_PASSWORD"])
TAG = "E2E-" + uuid.uuid4().hex[:6].upper()
now = lambda: datetime.now(UTC).isoformat()  # noqa: E731
c = httpx.Client(base_url=API, timeout=90)
results: list[tuple[str, bool, str]] = []


def step(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  - ' + detail if detail else ''}")
    if not ok:
        summary()
        sys.exit(1)


def summary() -> None:
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n{passed}/{len(results)} checks passed against {API}")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def wav(seconds: float = 2.0) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"\x00\x00" * int(16000 * seconds))
    return buf.getvalue()


def reading(pid: str, **over) -> dict:
    sid = str(uuid.uuid5(uuid.NAMESPACE_OID, pid))
    rec = {
        "id": str(uuid.uuid4()),
        "participantId": pid,
        "sessionId": sid,
        "session": {"sessionId": sid, "participantId": pid, "appVersion": "e2e", "deviceInfo": "e2e script", "startedAt": now()},
        "passageId": "P-EN-E1",
        "title": "My Pet Cat",
        "language": "English",
        "level": "Easy",
        "createdAt": now(),
        "referenceText": "The boy went to school.",
        "transcript": "the boy go to school",
        "asrStatus": "completed",
        "asrModelVersion": "vosk-model-small-en-in-0.4",
        "asrConfidence": 0.9,
        "durationSec": 6,
        "accuracy": 80,
        "wpm": 50,
        "wcpm": 40,
        "pace": "Slow",
        "mistakesCount": 1,
        "substitutions": 1,
        "omissions": 0,
        "insertions": 0,
        "practiceWords": ["went"],
        "words": [
            {"status": "correct", "ref": "The", "hyp": "the"},
            {"status": "correct", "ref": "boy", "hyp": "boy"},
            {"status": "substitution", "ref": "went", "hyp": "go"},
            {"status": "correct", "ref": "to", "hyp": "to"},
            {"status": "correct", "ref": "school.", "hyp": "school"},
        ],
        "aiStatus": "pending",
    }
    rec.update(over)
    return rec


def main() -> int:
    r = c.get("/health/ready")
    step("server ready", r.status_code == 200, json.dumps(r.json().get("checks", {}))[:160])
    ai_ready = r.json()["checks"]["ai"]["configured"]

    r = c.post("/auth/staff/login", json={"email": ADMIN[0], "password": ADMIN[1]})
    step("admin login", r.status_code == 200, r.text[:120])
    ah = auth(r.json()["access_token"])

    school = c.post("/admin/schools", json={"name": f"{TAG} School"}, headers=ah).json()
    cls = c.post("/admin/classes", json={"schoolId": school["id"], "grade": 4, "section": "A"}, headers=ah).json()
    other = c.post("/admin/classes", json={"schoolId": school["id"], "grade": 5, "section": "B"}, headers=ah).json()
    pw = "E2e-" + uuid.uuid4().hex
    t_email, r_email = f"{TAG.lower()}-teacher@e2e.invalid", f"{TAG.lower()}-research@e2e.invalid"
    c.post("/admin/staff", json={"email": t_email, "fullName": f"{TAG} Teacher", "password": pw, "role": "teacher", "classIds": [cls["id"]]}, headers=ah)
    c.post("/admin/staff", json={"email": r_email, "fullName": f"{TAG} Researcher", "password": pw, "role": "researcher"}, headers=ah)
    step("admin set up school, classes, teacher, researcher", "joinCode" in cls)

    pid = f"{TAG}-S1"
    r = c.post("/student/register", json={"student_id": pid, "fullName": f"{TAG} Student", "password": "student-pw-1", "classCode": cls["joinCode"]})
    step("student registers with class code", r.status_code == 201, r.text[:120])
    sh = auth(r.json()["access_token"])
    r2 = c.post("/student/register", json={"student_id": f"{TAG}-S2", "fullName": f"{TAG} Other", "password": "student-pw-1", "classCode": other["joinCode"]})
    oh = auth(r2.json()["access_token"])

    rec = reading(pid)
    r = c.post("/sync/reading", data={"record": json.dumps(rec)}, headers=sh)
    step("sync refused until consent is on the server (428, retryable)", r.status_code == 428, r.text[:100])

    consent_id = str(uuid.uuid4())
    consent = {
        "id": consent_id, "participantId": pid, "consentVersion": "1.0", "acceptedAt": now(), "withdrawnAt": None,
        "signerType": "guardian", "signerName": f"{TAG} Guardian", "signerRelation": "Mother", "language": "kn",
        "audioConsent": True, "handwritingConsent": True, "researchConsent": True, "status": "active",
    }
    step("guardian consent synced", c.post("/sync/consent", data={"record": json.dumps(consent)}, headers=sh).status_code == 200)
    oc = {**consent, "id": str(uuid.uuid4()), "participantId": f"{TAG}-S2"}
    c.post("/sync/consent", data={"record": json.dumps(oc)}, headers=oh)

    audio = wav()
    rec["audioMd5"] = hashlib.md5(audio).hexdigest()
    r = c.post("/sync/reading", data={"record": json.dumps(rec)}, files={"file": ("a.wav", audio, "audio/wav")}, headers=sh)
    b = r.json()
    step("English reading + WAV synced, checksum confirmed, metrics verified",
         r.status_code == 200 and b["file_md5"] == rec["audioMd5"] and b["metrics_verified"] is True, json.dumps(b)[:160])
    r = c.post("/sync/reading", data={"record": json.dumps(rec)}, files={"file": ("a.wav", audio, "audio/wav")}, headers=sh)
    step("retrying the same upload is idempotent", r.json()["status"] == "unchanged")

    kn = reading(pid, language="Kannada", passageId="P-KN-E1", referenceText="ನನ್ನ ಶಾಲೆ ತುಂಬಾ ಸುಂದರವಾಗಿದೆ.", transcript="",
                 asrStatus="pending", accuracy=None, wpm=None, wcpm=None, substitutions=None, omissions=None, insertions=None,
                 mistakesCount=None, words=[], practiceWords=[])
    r = c.post("/sync/reading", data={"record": json.dumps(kn)}, files={"file": ("k.wav", wav(3), "audio/wav")}, headers=sh)
    step("Kannada reading synced as pending transcription (audio kept, no metrics)", r.status_code == 200 and r.json()["metrics_verified"] is None)
    done = {**kn, "asrStatus": "completed", "transcript": "ನನ್ನ ಶಾಲೆ ಸುಂದರವಾಗಿದೆ", "accuracy": 75, "wpm": 30, "wcpm": 30,
            "substitutions": 0, "omissions": 1, "insertions": 0, "mistakesCount": 1}
    r = c.post("/sync/reading", data={"record": json.dumps(done)}, headers=sh)
    step("pending Kannada reading completed later; server verifies Kannada alignment", r.json().get("metrics_verified") is True, r.text[:120])

    w = {
        "id": str(uuid.uuid4()), "participantId": pid, "promptId": "W-EN-1", "prompt": "Describe your favourite festival.",
        "language": "English", "createdAt": now(), "inputMethod": "typed", "originalOcr": None, "ocrConfidence": None,
        "correctedText": "My favrite festival is Diwali. We light lamps.", "wordCount": 8, "sentenceCount": 2, "aiStatus": "pending",
    }
    step("typed writing synced", c.post("/sync/writing", data={"record": json.dumps(w)}, headers=sh).status_code == 200)

    if ai_ready:
        r = c.post("/ai/reading-feedback", json={"attempt_id": rec["id"], "language": "English", "level": "Easy",
                                                 "reference_text": rec["referenceText"], "transcript": rec["transcript"],
                                                 "metrics": {"accuracy": 80, "wpm": 50, "pace": "Slow", "substitutions": 1, "practice_words": ["went"]},
                                                 "mistakes": [{"status": "substitution", "ref": "went", "hyp": "go"}]}, headers=sh)
        step("Gemini reading feedback (validated, versioned)", r.status_code == 200 and r.json().get("prompt_version") == "reading-feedback-v1.0", r.text[:160])
        r = c.post("/ai/writing-assessment", json={"attempt_id": w["id"], "language": "English", "text": w["correctedText"], "min_words": 40}, headers=sh)
        step("Gemini writing assessment", r.status_code == 200 and 0 <= r.json().get("score", -1) <= 10, r.text[:160])
    else:
        print("SKIP  AI feedback (server has no GEMINI_API_KEY)")

    th = auth(c.post("/auth/staff/login", json={"email": t_email, "password": pw}).json()["access_token"])
    studs = c.get("/teacher/students", headers=th).json()
    step("teacher sees only their class", [s["participantId"] for s in studs] == [pid], str([s["participantId"] for s in studs]))
    s = studs[0]
    eng = next(a for a in s["recentReadingAttempts"] if a["language"] == "English")
    step("teacher sees word-level errors and transcript", eng["words"][2] == {"status": "substitution", "ref": "went", "hyp": "go"})
    url = c.get(f"/teacher/reading/{eng['id']}/audio", headers=th).json()["url"]
    audio_back = httpx.get(url, timeout=60).content
    step("signed audio URL returns the original recording", hashlib.md5(audio_back).hexdigest() == rec["audioMd5"])
    an = c.get("/teacher/analytics", params={"classId": cls["id"]}, headers=th).json()
    step("class analytics from stored attempts", an["completion"]["readingAny"] == 1, json.dumps(an["completion"]))
    mw = c.get("/teacher/missed-words", headers=th).json()
    step("missed words aggregated", any(m["word"] == "went" for m in mw))
    outsider = c.get("/teacher/students", headers=ah).json()
    o = next(x for x in outsider if x["participantId"] == f"{TAG}-S2")
    step("teacher cannot open a student in another class", c.get(f"/teacher/students/{o['studentId']}", headers=th).status_code == 404)

    rh = auth(c.post("/auth/staff/login", json={"email": r_email, "password": pw}).json()["access_token"])
    r = c.get("/research/export", params={"dataset": "reading"}, headers=rh)
    text = r.content.decode("utf-8-sig")
    step("researcher export is de-identified", r.status_code == 200 and pid in text and f"{TAG} Student" not in text and f"{TAG} Guardian" not in text)
    step("researcher cannot list named students", c.get("/teacher/students", headers=rh).status_code == 403)

    consent["status"], consent["withdrawnAt"] = "withdrawn", now()
    c.post("/sync/consent", data={"record": json.dumps(consent)}, headers=sh)
    r = c.get("/research/export", params={"dataset": "reading"}, headers=rh)
    step("withdrawn participant disappears from exports", pid not in r.content.decode("utf-8-sig"))
    step("no new data accepted after withdrawal", c.post("/sync/reading", data={"record": json.dumps(reading(pid))}, headers=sh).status_code == 428)

    # Clean up: both E2E students go through the auditable deletion workflow.
    for h in (sh, oh):
        c.post("/student/me/deletion-request", json={"reason": f"{TAG} automated test cleanup"}, headers=h)
    reqs = [d for d in c.get("/admin/deletion-requests", headers=ah).json() if d["participantId"].startswith(TAG) and d["status"] == "pending"]
    for d in reqs:
        c.post(f"/admin/deletion-requests/{d['id']}", json={"action": "complete", "note": "E2E cleanup"}, headers=ah)
    step("deletion workflow removes the test participants", len(reqs) == 2 and c.get("/student/me", headers=sh).status_code == 401)

    summary()
    return 0


if __name__ == "__main__":
    sys.exit(main())
