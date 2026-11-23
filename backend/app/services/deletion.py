"""Participant data deletion: database rows and stored media.

Database rows are deleted in the request's transaction. Object keys are first written to the
`storage_deletions` queue in that same transaction, and objects are removed only after it commits:
if the commit fails nothing is lost, and if storage is unreachable the keys stay queued for
`python -m app.cli purge-storage` instead of being forgotten.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import (
    AiAssessment,
    ConsentRecord,
    DeviceSession,
    OcrRecord,
    ReadingAttempt,
    RecordRevision,
    StorageDeletion,
    Student,
    TeacherComment,
    WritingAttempt,
)
from app.services.storage import Storage


def media_keys_for(db: Session, student_id: uuid.UUID) -> set[str]:
    keys: set[str] = set()
    keys |= {k for k in db.scalars(select(ReadingAttempt.audio_key).where(ReadingAttempt.student_id == student_id)) if k}
    keys |= {k for k in db.scalars(select(WritingAttempt.image_key).where(WritingAttempt.student_id == student_id)) if k}
    keys |= {k for k in db.scalars(select(OcrRecord.image_key).where(OcrRecord.student_id == student_id)) if k}
    keys |= {k for k in db.scalars(select(RecordRevision.file_key).where(RecordRevision.student_id == student_id)) if k}
    return keys


def delete_participant(db: Session, student_id: uuid.UUID, request_id: uuid.UUID | None) -> dict:
    """Removes a participant's research data and anonymises the account. Returns row counts."""
    keys = media_keys_for(db, student_id)
    counts: dict[str, int] = {}
    # Order matters for foreign keys: writing_attempts references ocr_records; attempts reference sessions.
    for model in (RecordRevision, AiAssessment, ReadingAttempt, WritingAttempt, TeacherComment, OcrRecord, DeviceSession):
        counts[model.__tablename__] = db.execute(delete(model).where(model.student_id == student_id)).rowcount
    now = datetime.now(UTC)
    for c in db.scalars(select(ConsentRecord).where(ConsentRecord.student_id == student_id)):
        # Kept as evidence that data was collected with consent; the signer's name is removed.
        c.signer_name = "[deleted]"
        if c.status == "active":
            c.status = "withdrawn"
            c.withdrawn_at = now
    s = db.get(Student, student_id)
    if s:
        s.full_name = "[deleted]"
        s.email = None
        s.profile = {}
        s.class_id = None
        s.is_active = False
        s.token_version += 1
        s.password_hash = "!deleted"
    if keys:
        rows = [{"object_key": k, "reason": "participant_deletion", "deletion_request_id": request_id, "attempts": 0} for k in sorted(keys)]
        db.execute(insert(StorageDeletion).values(rows).on_conflict_do_nothing(index_elements=["object_key"]))
    counts["files_queued"] = len(keys)
    return counts


def purge_pending(db: Session, storage: Storage, limit: int = 1000) -> dict:
    """Deletes queued objects. Run after the queueing transaction has committed."""
    done = failed = 0
    rows = db.scalars(select(StorageDeletion).where(StorageDeletion.completed_at.is_(None)).order_by(StorageDeletion.id).limit(limit)).all()
    for row in rows:
        row.attempts += 1
        try:
            storage.delete(row.object_key)
            if storage.exists(row.object_key):
                raise RuntimeError("object still present after delete")
            row.completed_at = datetime.now(UTC)
            row.last_error = None
            done += 1
        except Exception as e:  # noqa: BLE001 - any storage failure is retried later
            row.last_error = f"{type(e).__name__}: {e}"[:200]
            failed += 1
    db.flush()
    return {"deleted": done, "failed": failed, "remaining": failed}
