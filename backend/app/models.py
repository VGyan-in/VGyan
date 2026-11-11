"""PostgreSQL schema.

Research lineage is kept in layers that are never overwritten in place:
  * Original media (audio / handwriting image) is stored content-addressed by SHA-256; the
    attempt row points at the first file received and later uploads never replace it.
  * Every sync receipt is appended to `record_revisions` with the exact JSON received.
  * Every AI generation and every server OCR call is appended to `ai_assessments` / `ocr_records`.
  * `original_ocr` and `corrected_text` are separate columns; corrections never replace the OCR text.
Personal data (names, e-mail, guardian name) lives only in `students`, `consent_records` and
`staff_users`; research exports use `participant_id` only.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


TS = DateTime(timezone=True)


class School(Base):
    __tablename__ = "schools"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    district: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)

    classes: Mapped[list["ClassGroup"]] = relationship(back_populates="school")


class ClassGroup(Base):
    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("school_id", "grade", "section", name="uq_class_school_grade_section"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id", ondelete="RESTRICT"), nullable=False)
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    section: Mapped[str] = mapped_column(String(10), nullable=False)
    # Students type this code once in the app to join the class; it is what lets a
    # teacher see them. Not a secret, but not guessable either.
    join_code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)

    school: Mapped[School] = relationship(back_populates="classes")


class StaffUser(Base):
    __tablename__ = "staff_users"
    __table_args__ = (CheckConstraint("role in ('teacher','researcher','admin')", name="ck_staff_role"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    school_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("schools.id", ondelete="SET NULL"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(TS)

    school: Mapped[School | None] = relationship()


class TeacherClass(Base):
    __tablename__ = "teacher_classes"

    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("staff_users.id", ondelete="CASCADE"), primary_key=True)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)


class Student(Base):
    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participant_id: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(254), index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    class_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), index=True)
    # Background details from the app's profile screen (grade, section, school, medium, languages,
    # age group, gender). Free-form JSON so the research team can add questions without a migration.
    profile: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TS, default=utcnow, onupdate=utcnow, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(TS)

    class_group: Mapped[ClassGroup | None] = relationship()


class ConsentRecord(Base):
    __tablename__ = "consent_records"
    __table_args__ = (
        CheckConstraint("status in ('active','withdrawn')", name="ck_consent_status"),
        CheckConstraint("signer_type in ('guardian','student')", name="ck_consent_signer"),
        Index("ix_consent_student_accepted", "student_id", "accepted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # client-generated
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"), nullable=False)
    consent_version: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    signer_type: Mapped[str] = mapped_column(String(12), nullable=False)
    signer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    signer_relation: Mapped[str] = mapped_column(String(60), nullable=False, default="")
    language: Mapped[str] = mapped_column(String(8), nullable=False)
    audio_consent: Mapped[bool] = mapped_column(Boolean, nullable=False)
    handwriting_consent: Mapped[bool] = mapped_column(Boolean, nullable=False)
    research_consent: Mapped[bool] = mapped_column(Boolean, nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(TS, nullable=False)
    withdrawn_at: Mapped[datetime | None] = mapped_column(TS)
    received_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TS, default=utcnow, onupdate=utcnow, nullable=False)


class DeviceSession(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # client-generated
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"), nullable=False, index=True)
    app_version: Mapped[str] = mapped_column(String(40), nullable=False)
    device_info: Mapped[str] = mapped_column(String(200), nullable=False)
    started_at: Mapped[datetime] = mapped_column(TS, nullable=False)
    received_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)


class Passage(Base):
    """Reading passages and writing prompts (assignments). Text edits bump `version`;
    attempts keep their own copy of the reference text, so history stays reproducible."""

    __tablename__ = "passages"
    __table_args__ = (
        CheckConstraint("kind in ('reading','writing')", name="ck_passage_kind"),
        CheckConstraint("language in ('English','Kannada')", name="ck_passage_language"),
        Index("ix_passages_kind_lang_level", "kind", "language", "level"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    language: Mapped[str] = mapped_column(String(10), nullable=False)
    level: Mapped[str | None] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    kannada_title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    text: Mapped[str] = mapped_column(Text, nullable=False)
    kannada_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    min_words: Mapped[int | None] = mapped_column(Integer)
    hint: Mapped[str] = mapped_column(Text, nullable=False, default="")
    kannada_hint: Mapped[str] = mapped_column(Text, nullable=False, default="")
    grade_min: Mapped[int | None] = mapped_column(Integer)
    grade_max: Mapped[int | None] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TS, default=utcnow, onupdate=utcnow, nullable=False)


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (UniqueConstraint("passage_id", "class_id", name="uq_assignment_passage_class"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    passage_id: Mapped[str] = mapped_column(ForeignKey("passages.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"))
    due_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)


class ReadingAttempt(Base):
    __tablename__ = "reading_attempts"
    __table_args__ = (
        CheckConstraint("language in ('English','Kannada')", name="ck_reading_language"),
        CheckConstraint("accuracy >= 0 and accuracy <= 100", name="ck_reading_accuracy"),
        CheckConstraint("asr_status in ('completed','pending')", name="ck_reading_asr_status"),
        CheckConstraint("asr_status = 'pending' or accuracy is not null", name="ck_reading_metrics_when_completed"),
        Index("ix_reading_student_created", "student_id", "client_created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # client-generated
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"), nullable=False)
    session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sessions.id", ondelete="SET NULL"))
    passage_id: Mapped[str] = mapped_column(String(40), nullable=False)
    language: Mapped[str] = mapped_column(String(10), nullable=False)
    level: Mapped[str] = mapped_column(String(10), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    # Original → processed → assessed
    reference_text: Mapped[str] = mapped_column(Text, nullable=False)
    transcript: Mapped[str] = mapped_column(Text, nullable=False, default="")
    asr_words: Mapped[list | None] = mapped_column(JSONB)
    asr_confidence: Mapped[float | None] = mapped_column(Float)
    asr_model_version: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    # "pending": recorded without an installed speech model. Audio is kept; metrics stay NULL until
    # the phone transcribes it and sends the completed revision. Pending rows are excluded from analytics.
    asr_status: Mapped[str] = mapped_column(String(12), nullable=False, default="completed", server_default="completed")
    asr_ms: Mapped[int | None] = mapped_column(Integer)
    aligned_words: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    duration_sec: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[float | None] = mapped_column(Float)
    wpm: Mapped[float | None] = mapped_column(Float)
    wcpm: Mapped[float | None] = mapped_column(Float)
    pace: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    mistakes: Mapped[int | None] = mapped_column(Integer)
    substitutions: Mapped[int | None] = mapped_column(Integer)
    omissions: Mapped[int | None] = mapped_column(Integer)
    insertions: Mapped[int | None] = mapped_column(Integer)
    practice_words: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    fluency: Mapped[dict | None] = mapped_column(JSONB)
    analysis_version: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    # Server re-runs the deterministic alignment on (reference_text, transcript) and records
    # whether the device's counts agree. A mismatch flags the record for review; it is never "fixed".
    metrics_verified: Mapped[bool | None] = mapped_column(Boolean)
    metrics_check: Mapped[dict | None] = mapped_column(JSONB)
    ai_status: Mapped[str] = mapped_column(String(12), nullable=False, default="pending")
    ai_feedback: Mapped[dict | None] = mapped_column(JSONB)
    ai_model_version: Mapped[str | None] = mapped_column(String(80))
    ai_prompt_version: Mapped[str | None] = mapped_column(String(80))
    audio_key: Mapped[str | None] = mapped_column(String(400))
    audio_sha256: Mapped[str | None] = mapped_column(String(64))
    audio_md5: Mapped[str | None] = mapped_column(String(32))
    audio_bytes: Mapped[int | None] = mapped_column(BigInteger)
    audio_mime: Mapped[str | None] = mapped_column(String(60))
    client_created_at: Mapped[datetime] = mapped_column(TS, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    received_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TS, default=utcnow, onupdate=utcnow, nullable=False)

    student: Mapped[Student] = relationship()


class WritingAttempt(Base):
    __tablename__ = "writing_attempts"
    __table_args__ = (
        CheckConstraint("language in ('English','Kannada')", name="ck_writing_language"),
        CheckConstraint("input_method in ('typed','camera','gallery')", name="ck_writing_input"),
        Index("ix_writing_student_created", "student_id", "client_created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # client-generated
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"), nullable=False)
    session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sessions.id", ondelete="SET NULL"))
    prompt_id: Mapped[str] = mapped_column(String(40), nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    language: Mapped[str] = mapped_column(String(10), nullable=False)
    input_method: Mapped[str] = mapped_column(String(10), nullable=False)
    # Original → processed → assessed
    original_ocr: Mapped[str | None] = mapped_column(Text)
    ocr_confidence: Mapped[float | None] = mapped_column(Float)
    ocr_engine_version: Mapped[str | None] = mapped_column(String(80))
    # Link to the server's own record of the OCR call, and whether the device's original_ocr
    # matches what the server's OCR engine actually returned.
    ocr_record_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("ocr_records.id", ondelete="SET NULL"))
    ocr_matches_server: Mapped[bool | None] = mapped_column(Boolean)
    corrected_text: Mapped[str] = mapped_column(Text, nullable=False)
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sentence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metrics: Mapped[dict | None] = mapped_column(JSONB)
    score: Mapped[float | None] = mapped_column(Float)
    grammar_score: Mapped[float | None] = mapped_column(Float)
    vocabulary_score: Mapped[float | None] = mapped_column(Float)
    spelling_score: Mapped[float | None] = mapped_column(Float)
    ai_status: Mapped[str] = mapped_column(String(12), nullable=False, default="pending")
    ai_feedback: Mapped[dict | None] = mapped_column(JSONB)
    ai_model_version: Mapped[str | None] = mapped_column(String(80))
    ai_prompt_version: Mapped[str | None] = mapped_column(String(80))
    image_key: Mapped[str | None] = mapped_column(String(400))
    image_sha256: Mapped[str | None] = mapped_column(String(64))
    image_md5: Mapped[str | None] = mapped_column(String(32))
    image_bytes: Mapped[int | None] = mapped_column(BigInteger)
    image_mime: Mapped[str | None] = mapped_column(String(60))
    client_created_at: Mapped[datetime] = mapped_column(TS, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    received_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TS, default=utcnow, onupdate=utcnow, nullable=False)

    student: Mapped[Student] = relationship()


class RecordRevision(Base):
    """Append-only log of every record version the server accepted (exact JSON as received)."""

    __tablename__ = "record_revisions"
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "revision", name="uq_revision_entity_rev"),
        Index("ix_revision_entity", "entity_type", "entity_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(20), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    payload_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    file_key: Mapped[str | None] = mapped_column(String(400))
    file_sha256: Mapped[str | None] = mapped_column(String(64))
    received_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)


class AiAssessment(Base):
    """Every AI generation the server performed, successful or not."""

    __tablename__ = "ai_assessments"
    __table_args__ = (
        CheckConstraint("kind in ('reading','writing')", name="ck_ai_kind"),
        CheckConstraint("status in ('completed','failed')", name="ck_ai_status"),
        Index("ix_ai_attempt", "kind", "attempt_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    attempt_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"), nullable=False, index=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    model_version: Mapped[str] = mapped_column(String(80), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(80), nullable=False)
    input_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    output: Mapped[dict | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)


class OcrRecord(Base):
    """Server-side record of every OCR call: the original image and the raw text the engine
    returned, captured before the student can edit anything."""

    __tablename__ = "ocr_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"), nullable=False, index=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False)
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    engine_version: Mapped[str] = mapped_column(String(80), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float)
    image_key: Mapped[str | None] = mapped_column(String(400))
    image_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    image_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)


class TeacherComment(Base):
    __tablename__ = "teacher_comments"
    __table_args__ = (CheckConstraint("category in ('Intervention','Praise','Parent Note','General')", name="ck_comment_category"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("staff_users.id", ondelete="RESTRICT"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)


class DeletionRequest(Base):
    __tablename__ = "deletion_requests"
    __table_args__ = (CheckConstraint("status in ('pending','completed','rejected')", name="ck_deletion_status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="pending")
    requested_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)
    processed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"))
    processed_at: Mapped[datetime | None] = mapped_column(TS)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")


class AuditLog(Base):
    """Who touched what. `details` never holds personal data or student content."""

    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_created", "created_at"), Index("ix_audit_target", "target_type", "target_id"))

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor_type: Mapped[str] = mapped_column(String(12), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(30))
    target_id: Mapped[str | None] = mapped_column(String(64))
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)


class ResearchExport(Base):
    __tablename__ = "research_exports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requested_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("staff_users.id", ondelete="RESTRICT"), nullable=False)
    dataset: Mapped[str] = mapped_column(String(20), nullable=False)
    filters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, default=utcnow, nullable=False)
