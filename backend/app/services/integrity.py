"""Cross-checks between the database and object storage.

Run with `python -m app.cli integrity-check` (exit code 1 when a problem is found). It reports
counts and object keys only; keys contain participant IDs, never names.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    ConsentRecord,
    DeviceSession,
    OcrRecord,
    ReadingAttempt,
    RecordRevision,
    StorageDeletion,
    Student,
    WritingAttempt,
)
from app.services.storage import Storage

MEDIA_PREFIXES = ("audio/", "image/", "ocr/")


def referenced_keys(db: Session) -> set[str]:
    keys: set[str] = set()
    for col in (ReadingAttempt.audio_key, WritingAttempt.image_key, OcrRecord.image_key, RecordRevision.file_key):
        keys |= {k for k in db.scalars(select(col).where(col.is_not(None)))}
    return keys


def run_integrity_check(db: Session, storage: Storage) -> dict:
    referenced = referenced_keys(db)
    pending_delete = set(db.scalars(select(StorageDeletion.object_key).where(StorageDeletion.completed_at.is_(None))))
    stored: set[str] = set()
    for prefix in MEDIA_PREFIXES:
        stored |= set(storage.list_keys(prefix))

    missing = sorted(referenced - stored)
    orphaned = sorted(stored - referenced - pending_delete)
    # Objects that a completed deletion should have removed but that still exist.
    deleted_but_present = sorted(
        set(db.scalars(select(StorageDeletion.object_key).where(StorageDeletion.completed_at.is_not(None)))) & stored
    )

    inactive = select(Student.id).where(Student.is_active.is_(False), Student.password_hash == "!deleted")
    leftovers = {
        model.__tablename__: db.scalar(select(func.count()).select_from(model).where(model.student_id.in_(inactive))) or 0
        for model in (ReadingAttempt, WritingAttempt, RecordRevision, OcrRecord, DeviceSession)
    }
    with_consent = select(ConsentRecord.student_id)
    no_consent = {
        model.__tablename__: db.scalar(select(func.count()).select_from(model).where(model.student_id.not_in(with_consent))) or 0
        for model in (ReadingAttempt, WritingAttempt)
    }
    problems = (
        len(missing) + len(deleted_but_present) + sum(leftovers.values()) + sum(no_consent.values()) + len(orphaned) + len(pending_delete)
    )
    return {
        "ok": problems == 0,
        "referencedObjects": len(referenced),
        "storedObjects": len(stored),
        "missingObjects": missing[:100],
        "missingCount": len(missing),
        "orphanedObjects": orphaned[:100],
        "orphanedCount": len(orphaned),
        "pendingStorageDeletions": len(pending_delete),
        "deletedButPresent": deleted_but_present[:100],
        "deletedParticipantLeftovers": leftovers,
        "attemptsWithoutConsentRecord": no_consent,
    }
