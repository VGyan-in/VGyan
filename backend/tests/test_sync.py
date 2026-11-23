import hashlib
import json
import uuid

from tests.conftest import consent_record, give_consent, jpeg_bytes, reading_record, register, wav_bytes, writing_record


def post_reading(client, h, rec, audio: bytes | None = None):
    files = {"file": ("a.wav", audio, "audio/wav")} if audio is not None else None
    return client.post("/sync/reading", data={"record": json.dumps(rec)}, files=files, headers=h)


def test_reading_requires_consent_with_retryable_428(client):
    h = register(client)
    r = post_reading(client, h, reading_record())
    assert r.status_code == 428 and r.json()["error"]["code"] == "consent_required"


def test_reading_sync_is_idempotent_and_preserves_original_audio(client):
    h = register(client)
    give_consent(client, h)
    audio = wav_bytes()
    rec = reading_record(audioMd5=hashlib.md5(audio).hexdigest())

    r1 = post_reading(client, h, rec, audio)
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body["status"] == "created" and body["revision"] == 1
    assert body["file_sha256"] == hashlib.sha256(audio).hexdigest()
    assert body["file_md5"] == hashlib.md5(audio).hexdigest()
    assert body["metrics_verified"] is True

    # Exact retry (e.g. response lost on a flaky network) is a no-op.
    r2 = post_reading(client, h, rec, audio)
    assert r2.json()["status"] == "unchanged" and r2.json()["revision"] == 1

    # AI feedback arrives later: new revision, original audio untouched.
    rec2 = {
        **rec,
        "aiStatus": "completed",
        "feedback": {
            "summary": "Good",
            "strengths": [],
            "improvements": [],
            "modelVersion": "gemini-x",
            "promptVersion": "reading-feedback-v1.0",
        },
    }
    other_audio = wav_bytes(0.7)
    r3 = post_reading(client, h, {**rec2, "audioMd5": None}, other_audio)
    assert r3.json()["status"] == "updated" and r3.json()["revision"] == 2
    assert r3.json()["file_sha256"] == hashlib.sha256(audio).hexdigest()  # first original kept

    from app.db import session_factory
    from app.models import ReadingAttempt, RecordRevision

    with session_factory()() as db:
        a = db.get(ReadingAttempt, uuid.UUID(rec["id"]))
        assert a.ai_model_version == "gemini-x" and a.ai_prompt_version == "reading-feedback-v1.0"
        revs = db.query(RecordRevision).filter_by(entity_id=a.id).order_by(RecordRevision.revision).all()
        assert [r.revision for r in revs] == [1, 2]
        assert "audioUri" not in revs[0].payload and "synced" not in revs[0].payload  # device-local fields dropped
        assert revs[1].file_sha256 == hashlib.sha256(other_audio).hexdigest()  # second upload logged, not applied


def test_checksum_mismatch_rejected(client):
    h = register(client)
    give_consent(client, h)
    r = post_reading(client, h, reading_record(audioMd5="0" * 32), wav_bytes())
    assert r.status_code == 422 and r.json()["error"]["code"] == "integrity_mismatch"


def test_source_fields_are_immutable(client):
    h = register(client)
    give_consent(client, h)
    rec = reading_record()
    assert post_reading(client, h, rec).status_code == 200
    r = post_reading(client, h, {**rec, "transcript": "The boy went to school"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "immutable_field_changed"


def test_other_participants_records_are_rejected(client):
    h1 = register(client, pid="VG-1")
    give_consent(client, h1, pid="VG-1")
    h2 = register(client, pid="VG-2")
    give_consent(client, h2, pid="VG-2")
    rec = reading_record(pid="VG-1")
    assert post_reading(client, h1, rec).status_code == 200
    # VG-2 tries to overwrite VG-1's attempt (same UUID, own participant ID)
    r = post_reading(client, h2, {**rec, "participantId": "VG-2"})
    assert r.status_code == 403
    # or to upload a record claiming to be VG-1
    assert post_reading(client, h2, reading_record(pid="VG-1")).status_code == 403


def test_server_flags_metrics_that_do_not_match_the_transcript(client):
    h = register(client)
    give_consent(client, h)
    r = post_reading(client, h, reading_record(accuracy=100, substitutions=0))
    assert r.status_code == 200 and r.json()["metrics_verified"] is False


def test_audio_not_stored_without_audio_consent(client):
    h = register(client)
    give_consent(client, h, audio=False)
    r = post_reading(client, h, reading_record(), wav_bytes())
    assert r.status_code == 200
    assert r.json()["file_sha256"] is None  # phone keeps its copy: no server hash to confirm against


def test_bad_media_rejected(client):
    h = register(client)
    give_consent(client, h)
    r = post_reading(client, h, reading_record(), b"#!/bin/sh\necho not audio")
    assert r.status_code == 415
    r = post_reading(client, h, reading_record(), b"")
    assert r.status_code == 422


def test_invalid_record_fields(client):
    h = register(client)
    give_consent(client, h)
    r = post_reading(client, h, reading_record(accuracy=140))
    assert r.status_code == 422 and "accuracy" in r.json()["error"]["message"]
    r = client.post("/sync/reading", data={"record": "{not json"}, headers=h)
    assert r.status_code == 422


def test_withdrawn_consent_stops_new_data(client):
    h = register(client)
    cid = str(uuid.uuid4())
    give_consent(client, h, cid=cid)
    assert post_reading(client, h, reading_record()).status_code == 200
    give_consent(client, h, cid=cid, status="withdrawn")
    assert post_reading(client, h, reading_record()).status_code == 428
    # A withdrawn consent cannot be flipped back to active.
    r = client.post("/sync/consent", data={"record": json.dumps(consent_record(cid=cid))}, headers=h)
    assert r.status_code == 422


def test_writing_sync_keeps_ocr_and_correction_separately(client, fake_gemini):
    h = register(client)
    give_consent(client, h)
    fake_gemini.push_text("My favrite festival is Diwali.")
    ocr = client.post("/ocr", data={"language": "en"}, files={"file": ("w.jpg", jpeg_bytes(), "image/jpeg")}, headers=h).json()
    img = jpeg_bytes()
    rec = writing_record(ocrId=ocr["ocr_id"], ocrEngineVersion=ocr["engine_version"], imageMd5=hashlib.md5(img).hexdigest())
    r = client.post("/sync/writing", data={"record": json.dumps(rec)}, files={"file": ("w.jpg", img, "image/jpeg")}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["file_md5"] == hashlib.md5(img).hexdigest()

    from app.db import session_factory
    from app.models import WritingAttempt

    with session_factory()() as db:
        a = db.get(WritingAttempt, uuid.UUID(rec["id"]))
        assert a.original_ocr == "My favrite festival is Diwali."
        assert a.corrected_text == "My favourite festival is Diwali."
        assert a.ocr_matches_server is True and a.image_key

    # A later revision cannot overwrite the corrected text either.
    r = client.post("/sync/writing", data={"record": json.dumps({**rec, "correctedText": "edited"})}, headers=h)
    assert r.status_code == 422


def test_writing_flags_ocr_text_that_differs_from_server(client, fake_gemini):
    h = register(client)
    give_consent(client, h)
    fake_gemini.push_text("Real OCR output")
    ocr = client.post("/ocr", data={"language": "en"}, files={"file": ("w.jpg", jpeg_bytes(), "image/jpeg")}, headers=h).json()
    rec = writing_record(ocrId=ocr["ocr_id"], originalOcr="Tampered OCR output")
    assert client.post("/sync/writing", data={"record": json.dumps(rec)}, headers=h).status_code == 200
    from app.db import session_factory
    from app.models import WritingAttempt

    with session_factory()() as db:
        assert db.get(WritingAttempt, uuid.UUID(rec["id"])).ocr_matches_server is False


def test_my_report_returns_synced_history(client):
    h = register(client)
    give_consent(client, h)
    post_reading(client, h, reading_record())
    rep = client.get("/student/my_report", headers=h).json()
    assert len(rep["reading"]) == 1 and rep["reading"][0]["accuracy"] == 80
    assert rep["consent"]["status"] == "active"


def test_pending_transcription_keeps_audio_then_accepts_first_transcript(client):
    h = register(client)
    give_consent(client, h)
    audio = wav_bytes()
    pending = reading_record(
        language="Kannada",
        transcript="",
        asrStatus="pending",
        accuracy=None,
        wpm=None,
        wcpm=None,
        substitutions=None,
        omissions=None,
        insertions=None,
        mistakesCount=None,
        words=[],
        practiceWords=[],
    )
    r = post_reading(client, h, pending, audio)
    assert r.status_code == 200, r.text
    assert r.json()["metrics_verified"] is None and r.json()["file_md5"] == hashlib.md5(audio).hexdigest()

    # pending rows never show up in averages
    rep = client.get("/student/my_report", headers=h).json()
    assert rep["reading"][0]["asrStatus"] == "pending" and rep["reading"][0]["accuracy"] is None

    # The phone transcribes it later: transcript may be set once, metrics are verified.
    done = {**pending, **reading_record(rid=pending["id"], language="Kannada"), "asrStatus": "completed"}
    r2 = post_reading(client, h, done)
    assert r2.status_code == 200 and r2.json()["status"] == "updated" and r2.json()["metrics_verified"] is True

    # ...but never changed again, and never back to pending
    assert post_reading(client, h, {**done, "transcript": "The boy went"}).status_code == 422
    assert post_reading(client, h, pending).status_code == 422


def test_completed_reading_requires_metrics(client):
    h = register(client)
    give_consent(client, h)
    r = post_reading(client, h, reading_record(accuracy=None))
    assert r.status_code == 422
