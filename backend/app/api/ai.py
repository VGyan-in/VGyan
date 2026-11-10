import hashlib
import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.sync import _active_consent
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.ratelimit import limiter
from app.db import get_db
from app.deps import current_student
from app.models import AiAssessment, OcrRecord, Student
from app.schemas import (
    OcrOut,
    ReadingFeedbackIn,
    ReadingFeedbackOut,
    WritingAssessIn,
    WritingAssessmentOut,
)
from app.services import gemini
from app.services.analysis import normalize_word, tokenize, writing_counts
from app.services.ocr import run_ocr
from app.services.prompts import (
    READING_PROMPT_VERSION,
    READING_SCHEMA,
    READING_SYSTEM,
    READING_USER,
    WRITING_PROMPT_VERSION,
    WRITING_SCHEMA,
    WRITING_SYSTEM,
    WRITING_USER,
    lang_rule,
)
from app.services.storage import get_storage, media_key, spool_upload

router = APIRouter(tags=["ai"])


def _sha(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def _record(db: Session, student: Student, kind: str, body, status: str, model: str, prompt: str, output=None, error=None, latency=None):
    db.add(
        AiAssessment(
            kind=kind,
            attempt_id=body.attempt_id,
            student_id=student.id,
            language=body.language,
            status=status,
            model_version=model,
            prompt_version=prompt,
            input_sha256=_sha(body.model_dump(mode="json")),
            output=output,
            error=error,
            latency_ms=latency,
        )
    )


def get_settings_model() -> str:
    return get_settings().gemini_model


@router.post("/ai/reading-feedback", response_model=ReadingFeedbackOut)
def reading_feedback(body: ReadingFeedbackIn, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    limiter.check(f"ai:{student.id}", 30, 600)
    _active_consent(db, student)  # student content goes to a third-party model only with consent
    m = body.metrics
    mistakes = [w for w in body.mistakes if w.status in ("substitution", "omission")][:40]
    mistake_lines = "\n".join(f"- {w.ref} -> {w.hyp if w.status == 'substitution' else '(skipped)'}" for w in mistakes) or "- none"
    user = READING_USER.format(
        language=body.language,
        level=body.level or "unspecified",
        accuracy=f"{m.accuracy:g}",
        wpm=f"{m.wpm:g}",
        pace=m.pace,
        substitutions=m.substitutions,
        omissions=m.omissions,
        insertions=m.insertions,
        mistakes=mistake_lines,
        reference=body.reference_text,
        transcript=body.transcript,
    )
    try:
        data, r = gemini.generate_json(READING_SYSTEM.format(lang_rule=lang_rule(body.language)), user, READING_SCHEMA)
        out = ReadingFeedbackOut.model_validate(data)
    except (gemini.GeminiError, ValidationError) as e:
        _record(
            db,
            student,
            "reading",
            body,
            "failed",
            get_settings_model(),
            READING_PROMPT_VERSION,
            error=type(e).__name__ + ": " + str(e)[:300],
        )
        db.commit()
        raise ApiError(502, "ai_failed", "AI feedback could not be generated. It will be retried.") from e

    # Practice words must come from the passage; otherwise fall back to the app's deterministic list.
    vocab = {normalize_word(w) for w in tokenize(body.reference_text)}
    kept = [w for w in out.practice_words if normalize_word(w) in vocab]
    out.practice_words = (kept or m.practice_words)[:10]
    out.model_version = r.model_version
    out.prompt_version = READING_PROMPT_VERSION
    _record(db, student, "reading", body, "completed", r.model_version, READING_PROMPT_VERSION, out.model_dump(), latency=r.latency_ms)
    return out


@router.post("/ai/writing-assessment", response_model=WritingAssessmentOut)
def writing_assessment(body: WritingAssessIn, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    limiter.check(f"ai:{student.id}", 30, 600)
    _active_consent(db, student)
    counts = writing_counts(body.text)
    user = WRITING_USER.format(
        language=body.language,
        grade=body.grade or (student.profile or {}).get("grade") or "unspecified",
        prompt=body.prompt or "(free writing)",
        min_words=body.min_words,
        word_count=counts["word_count"],
        sentence_count=counts["sentence_count"],
        text=body.text,
    )
    try:
        data, r = gemini.generate_json(WRITING_SYSTEM.format(lang_rule=lang_rule(body.language)), user, WRITING_SCHEMA)
        out = WritingAssessmentOut.model_validate(data)
    except (gemini.GeminiError, ValidationError) as e:
        _record(
            db,
            student,
            "writing",
            body,
            "failed",
            get_settings_model(),
            WRITING_PROMPT_VERSION,
            error=type(e).__name__ + ": " + str(e)[:300],
        )
        db.commit()
        raise ApiError(502, "ai_failed", "AI assessment could not be generated. It will be retried.") from e

    # Keep only "misspelled" words that really occur in the student's text.
    present = {normalize_word(w) for w in tokenize(body.text)}
    out.misspelled = [w for w in out.misspelled if normalize_word(w) in present]
    out.model_version = r.model_version
    out.prompt_version = WRITING_PROMPT_VERSION
    _record(db, student, "writing", body, "completed", r.model_version, WRITING_PROMPT_VERSION, out.model_dump(), latency=r.latency_ms)
    return out


@router.post("/ocr", response_model=OcrOut)
def ocr(
    language: str = Form(...),
    file: UploadFile = File(...),
    student: Student = Depends(current_student),
    db: Session = Depends(get_db),
):
    limiter.check(f"ocr:{student.id}", 20, 600)
    if not _active_consent(db, student).handwriting_consent:
        raise ApiError(403, "handwriting_consent_required", "Handwriting photos need guardian consent. Please type your answer.")
    lang = {"kn": "Kannada", "en": "English", "Kannada": "Kannada", "English": "English"}.get(language)
    if not lang:
        raise ApiError(422, "invalid_language", "language must be 'en' or 'kn'")
    spooled = spool_upload(file.file, "image")
    try:
        raw = Path(spooled.path).read_bytes()
        result = run_ocr(raw, lang)
        # Keep the exact image the OCR saw, so the original → OCR text link survives even if
        # the attempt is never synced.
        key = media_key("ocr", student.participant_id, "ocr", spooled.sha256, spooled.ext)
        get_storage().put_file(key, spooled.path, spooled.mime)
    finally:
        Path(spooled.path).unlink(missing_ok=True)
    rec = OcrRecord(
        student_id=student.id,
        language=lang,
        provider=result.provider,
        engine_version=result.engine_version,
        text=result.text,
        confidence=result.confidence,
        image_key=key,
        image_sha256=spooled.sha256,
        image_bytes=spooled.size,
        latency_ms=result.latency_ms,
    )
    db.add(rec)
    db.flush()
    return OcrOut(
        ocr_id=rec.id,
        text=result.text,
        confidence=result.confidence,
        engine_version=result.engine_version,
        image_sha256=spooled.sha256,
    )
