"""Idempotent upload of on-device records.

Each POST carries a `record` JSON form field (the record exactly as stored on the phone) and,
for reading/writing, an optional `file` (original audio or handwriting image).

Status codes the app relies on (client/src/core/sync/uploader.ts):
  200  stored (created / updated / unchanged) - safe to mark synced
  401  token expired -> retry after sign-in
  403  record belongs to another participant -> permanent failure, needs a person
  422  invalid record or an immutable source field changed -> permanent failure, needs a person
  428  no active research consent on the server yet -> retry later (consent may still be queued)
"""

import hashlib
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db import get_db
from app.deps import current_student
from app.models import (
    ConsentRecord,
    DeviceSession,
    OcrRecord,
    ReadingAttempt,
    RecordRevision,
    Student,
    WritingAttempt,
)
from app.schemas import ConsentIn, ReadingRecordIn, SessionIn, SyncOut, WritingRecordIn
from app.services.analysis import ANALYSIS_VERSION, verify_reading_metrics
from app.services.audit import audit
from app.services.storage import StoredUpload, get_storage, media_key, spool_upload

router = APIRouter(prefix="/sync", tags=["sync"])

# Device-local fields that are not part of the research record.
_LOCAL_ONLY = {"synced", "audioUri", "imageUri"}

READING_IMMUTABLE = ("reference_text", "transcript", "duration_sec", "passage_id", "language", "level")
WRITING_IMMUTABLE = ("original_ocr", "corrected_text", "input_method", "language", "prompt_id")


def _parse(record: str) -> dict:
    try:
        raw = json.loads(record)
    except json.JSONDecodeError as e:
        raise ApiError(422, "invalid_record", "record is not valid JSON") from e
    if not isinstance(raw, dict):
        raise ApiError(422, "invalid_record", "record must be a JSON object")
    return {k: v for k, v in raw.items() if k not in _LOCAL_ONLY}


def _validate(model, raw: dict):
    try:
        return model.model_validate(raw)
    except ValidationError as e:
        fields = ", ".join(".".join(str(p) for p in err["loc"]) for err in e.errors()[:5])
        raise ApiError(422, "invalid_record", f"Invalid record fields: {fields}") from e


def _digest(raw: dict) -> str:
    canonical = json.dumps(raw, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _own(student: Student, participant_id: str) -> None:
    if participant_id.strip().upper() != student.participant_id:
        raise ApiError(403, "participant_mismatch", "Record belongs to a different participant")


def _active_consent(db: Session, student: Student) -> ConsentRecord:
    c = db.scalar(select(ConsentRecord).where(ConsentRecord.student_id == student.id).order_by(ConsentRecord.accepted_at.desc()))
    if not c or c.status != "active" or not c.research_consent:
        raise ApiError(428, "consent_required", "No active research consent on the server yet")
    return c


def _upsert_session(db: Session, student: Student, s: SessionIn | None) -> uuid.UUID | None:
    if not s:
        return None
    existing = db.get(DeviceSession, s.session_id)
    if existing:
        if existing.student_id != student.id:
            raise ApiError(403, "participant_mismatch", "Session belongs to a different participant")
        return existing.id
    db.add(
        DeviceSession(
            id=s.session_id,
            student_id=student.id,
            app_version=s.app_version,
            device_info=s.device_info,
            started_at=s.started_at,
        )
    )
    db.flush()
    return s.session_id


def _last_revision(db: Session, entity_type: str, entity_id: uuid.UUID) -> RecordRevision | None:
    return db.scalar(
        select(RecordRevision)
        .where(RecordRevision.entity_type == entity_type, RecordRevision.entity_id == entity_id)
        .order_by(RecordRevision.revision.desc())
        .limit(1)
    )


def _store_file(kind: str, upload: UploadFile, participant_id: str, attempt_id: uuid.UUID) -> tuple[StoredUpload, str]:
    spooled = spool_upload(upload.file, kind)
    try:
        key = media_key(kind, participant_id, str(attempt_id), spooled.sha256, spooled.ext)
        get_storage().put_file(key, spooled.path, spooled.mime)
        return spooled, key
    finally:
        Path(spooled.path).unlink(missing_ok=True)


def _check_immutable(existing, rec_values: dict, fields: tuple[str, ...]) -> None:
    changed = [f for f in fields if getattr(existing, f) != rec_values[f]]
    if changed:
        raise ApiError(
            422,
            "immutable_field_changed",
            f"Source fields cannot change after upload: {', '.join(changed)}. The original is kept on the server.",
        )


@router.post("/consent", response_model=SyncOut)
def sync_consent(record: str = Form(...), student: Student = Depends(current_student), db: Session = Depends(get_db, scope="function")):
    raw = _parse(record)
    c = _validate(ConsentIn, raw)
    _own(student, c.participant_id)
    digest = _digest(raw)
    existing = db.get(ConsentRecord, c.id)
    if existing and existing.student_id != student.id:
        raise ApiError(403, "participant_mismatch", "Consent record belongs to a different participant")
    last = _last_revision(db, "consent", c.id) if existing else None
    if existing and last and last.payload_sha256 == digest:
        return SyncOut(status="unchanged", id=c.id, revision=last.revision)
    if existing:
        if existing.status == "withdrawn" and c.status == "active":
            raise ApiError(422, "consent_reactivation", "A withdrawn consent cannot be reactivated; record a new consent")
        # A consent record only ever changes by being withdrawn; what was agreed stays as signed.
        existing.status = c.status
        existing.withdrawn_at = c.withdrawn_at
        revision = (last.revision if last else 0) + 1
        status = "updated"
    else:
        existing = ConsentRecord(
            id=c.id,
            student_id=student.id,
            consent_version=c.consent_version,
            status=c.status,
            signer_type=c.signer_type,
            signer_name=c.signer_name.strip(),
            signer_relation=c.signer_relation.strip(),
            language=c.language,
            audio_consent=c.audio_consent,
            handwriting_consent=c.handwriting_consent,
            research_consent=c.research_consent,
            accepted_at=c.accepted_at,
            withdrawn_at=c.withdrawn_at,
        )
        db.add(existing)
        revision = 1
        status = "created"
    db.add(
        RecordRevision(entity_type="consent", entity_id=c.id, student_id=student.id, revision=revision, payload=raw, payload_sha256=digest)
    )
    audit(db, "student", student.id, f"consent.{c.status}", "consent", c.id, version=c.consent_version)
    return SyncOut(status=status, id=c.id, revision=revision)


@router.post("/reading", response_model=SyncOut)
def sync_reading(
    record: str = Form(...),
    file: UploadFile | None = File(default=None),
    student: Student = Depends(current_student),
    db: Session = Depends(get_db, scope="function"),
):
    raw = _parse(record)
    rec: ReadingRecordIn = _validate(ReadingRecordIn, raw)
    _own(student, rec.participant_id)
    consent = _active_consent(db, student)
    existing = db.get(ReadingAttempt, rec.id)
    if existing and existing.student_id != student.id:
        raise ApiError(403, "participant_mismatch", "Attempt belongs to a different participant")

    stored: StoredUpload | None = None
    key: str | None = None
    if file is not None and consent.audio_consent:
        stored, key = _store_file("audio", file, student.participant_id, rec.id)
        if (rec.audio_sha256 and rec.audio_sha256.lower() != stored.sha256) or (rec.audio_md5 and rec.audio_md5.lower() != stored.md5):
            raise ApiError(422, "integrity_mismatch", "Audio checksum does not match the uploaded file")

    digest = _digest(raw)
    last = _last_revision(db, "reading", rec.id) if existing else None
    file_unchanged = stored is None or (existing is not None and existing.audio_sha256 == stored.sha256)
    if existing and last and last.payload_sha256 == digest and file_unchanged:
        return _reading_result("unchanged", existing)

    values = {
        "passage_id": rec.passage_id,
        "language": rec.language,
        "level": rec.level,
        "reference_text": rec.reference_text,
        "transcript": rec.transcript,
        "duration_sec": rec.duration_sec,
    }
    pending = rec.asr_status == "pending"
    if not pending and None in (rec.accuracy, rec.wpm, rec.substitutions, rec.omissions, rec.insertions):
        raise ApiError(422, "invalid_record", "Completed readings need accuracy, wpm and error counts")
    if existing and existing.asr_status == "completed" and pending:
        raise ApiError(422, "immutable_field_changed", "A transcribed reading cannot go back to pending")
    check = (
        None
        if pending
        else verify_reading_metrics(
            rec.reference_text,
            rec.transcript,
            rec.duration_sec,
            {
                "accuracy": rec.accuracy,
                "wpm": rec.wpm,
                "substitutions": rec.substitutions,
                "omissions": rec.omissions,
                "insertions": rec.insertions,
            },
        )
    )
    session_id = _upsert_session(db, student, rec.session) or (
        rec.session_id if rec.session_id and db.get(DeviceSession, rec.session_id) else None
    )

    if existing:
        # While transcription was pending the transcript was empty; the first transcript is accepted once.
        fields = READING_IMMUTABLE if existing.asr_status == "completed" else tuple(f for f in READING_IMMUTABLE if f != "transcript")
        _check_immutable(existing, values, fields)
        if existing.asr_status == "pending":
            existing.transcript = rec.transcript
        a = existing
        status = "updated"
        revision = a.revision + 1
    else:
        a = ReadingAttempt(id=rec.id, student_id=student.id, client_created_at=rec.created_at, **values)
        db.add(a)
        status = "created"
        revision = 1

    a.session_id = a.session_id or session_id
    a.title = rec.title
    a.asr_words = [w.model_dump() for w in rec.asr_words] if rec.asr_words is not None else a.asr_words
    a.asr_confidence = rec.asr_confidence
    a.asr_model_version = rec.asr_model_version
    a.aligned_words = [w.model_dump(exclude_none=True) for w in rec.words]
    a.accuracy = rec.accuracy
    a.wpm = rec.wpm
    a.wcpm = rec.wcpm
    a.pace = rec.pace
    a.mistakes = rec.mistakes_count
    a.substitutions = rec.substitutions
    a.omissions = rec.omissions
    a.insertions = rec.insertions
    a.practice_words = rec.practice_words
    a.fluency = rec.fluency
    a.asr_status = rec.asr_status
    a.asr_ms = rec.asr_ms
    a.analysis_version = "" if pending else (rec.analysis_version or ANALYSIS_VERSION)
    a.metrics_verified = None if check is None else check["verified"]
    a.metrics_check = check
    a.ai_status = rec.ai_status
    if rec.feedback:
        a.ai_feedback = rec.feedback.model_dump(by_alias=True)
        a.ai_model_version = rec.feedback.model_version
        a.ai_prompt_version = rec.feedback.prompt_version
    if stored and not a.audio_key:
        # The first recording received is the original; it is never replaced.
        a.audio_key, a.audio_sha256, a.audio_md5 = key, stored.sha256, stored.md5
        a.audio_bytes, a.audio_mime = stored.size, stored.mime
    a.revision = revision
    db.add(
        RecordRevision(
            entity_type="reading",
            entity_id=rec.id,
            student_id=student.id,
            revision=revision,
            payload=raw,
            payload_sha256=digest,
            file_key=key,
            file_sha256=stored.sha256 if stored else None,
        )
    )
    db.flush()
    audit(db, "student", student.id, f"reading.{status}", "reading_attempt", rec.id, revision=revision)
    return _reading_result(status, a)


def _reading_result(status: str, a: ReadingAttempt) -> SyncOut:
    return SyncOut(
        status=status,
        id=a.id,
        revision=a.revision,
        file_sha256=a.audio_sha256,
        file_md5=a.audio_md5,
        file_bytes=a.audio_bytes,
        metrics_verified=a.metrics_verified,
    )


@router.post("/writing", response_model=SyncOut)
def sync_writing(
    record: str = Form(...),
    file: UploadFile | None = File(default=None),
    student: Student = Depends(current_student),
    db: Session = Depends(get_db, scope="function"),
):
    raw = _parse(record)
    rec: WritingRecordIn = _validate(WritingRecordIn, raw)
    _own(student, rec.participant_id)
    consent = _active_consent(db, student)
    existing = db.get(WritingAttempt, rec.id)
    if existing and existing.student_id != student.id:
        raise ApiError(403, "participant_mismatch", "Attempt belongs to a different participant")

    stored: StoredUpload | None = None
    key: str | None = None
    if file is not None and consent.handwriting_consent:
        stored, key = _store_file("image", file, student.participant_id, rec.id)
        if rec.image_md5 and rec.image_md5.lower() != stored.md5:
            raise ApiError(422, "integrity_mismatch", "Image checksum does not match the uploaded file")

    digest = _digest(raw)
    last = _last_revision(db, "writing", rec.id) if existing else None
    file_unchanged = stored is None or (existing is not None and existing.image_sha256 == stored.sha256)
    if existing and last and last.payload_sha256 == digest and file_unchanged:
        return _writing_result("unchanged", existing)

    values = {
        "original_ocr": rec.original_ocr,
        "corrected_text": rec.corrected_text,
        "input_method": rec.input_method,
        "language": rec.language,
        "prompt_id": rec.prompt_id,
    }
    session_id = _upsert_session(db, student, rec.session) or (
        rec.session_id if rec.session_id and db.get(DeviceSession, rec.session_id) else None
    )
    if existing:
        _check_immutable(existing, values, WRITING_IMMUTABLE)
        a = existing
        status = "updated"
        revision = a.revision + 1
    else:
        a = WritingAttempt(id=rec.id, student_id=student.id, client_created_at=rec.created_at, **values)
        db.add(a)
        status = "created"
        revision = 1

    if rec.ocr_id and a.ocr_record_id is None:
        ocr = db.get(OcrRecord, rec.ocr_id)
        if ocr and ocr.student_id == student.id:
            a.ocr_record_id = ocr.id
            a.ocr_matches_server = (rec.original_ocr or "").strip() == ocr.text.strip()

    a.session_id = a.session_id or session_id
    a.prompt_text = rec.prompt
    a.ocr_confidence = rec.ocr_confidence
    a.ocr_engine_version = rec.ocr_engine_version
    a.word_count = rec.word_count
    a.sentence_count = rec.sentence_count
    a.ai_status = rec.ai_status
    if rec.assessment:
        a.ai_feedback = rec.assessment.model_dump(by_alias=True)
        a.ai_model_version = rec.assessment.model_version
        a.ai_prompt_version = rec.assessment.prompt_version
        a.score = rec.assessment.score
        a.grammar_score = rec.assessment.grammar_score
        a.vocabulary_score = rec.assessment.vocabulary_score
        a.spelling_score = rec.assessment.spelling_score
    if stored and not a.image_key:
        a.image_key, a.image_sha256, a.image_md5 = key, stored.sha256, stored.md5
        a.image_bytes, a.image_mime = stored.size, stored.mime
    a.revision = revision
    db.add(
        RecordRevision(
            entity_type="writing",
            entity_id=rec.id,
            student_id=student.id,
            revision=revision,
            payload=raw,
            payload_sha256=digest,
            file_key=key,
            file_sha256=stored.sha256 if stored else None,
        )
    )
    db.flush()
    audit(db, "student", student.id, f"writing.{status}", "writing_attempt", rec.id, revision=revision)
    return _writing_result(status, a)


def _writing_result(status: str, a: WritingAttempt) -> SyncOut:
    return SyncOut(
        status=status,
        id=a.id,
        revision=a.revision,
        file_sha256=a.image_sha256,
        file_md5=a.image_md5,
        file_bytes=a.image_bytes,
    )
