"""De-identified research exports.

Only participants whose latest consent record is `active` with research consent are included.
Rows carry the Participant ID only: no names, e-mails, guardian names, school names or device paths.
"""

import csv
import hashlib
import io
import json
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.models import ConsentRecord, ReadingAttempt, ResearchExport, StaffUser, Student, WritingAttempt
from app.services.audit import audit

router = APIRouter(prefix="/research", tags=["research"])

# Demographics that are useful for analysis and not directly identifying.
SAFE_PROFILE = ("grade", "ageGroup", "gender", "schoolType", "medium", "nativeLanguage", "otherLanguages")


def consented_students(db: Session) -> dict:
    latest: dict = {}
    for c in db.scalars(select(ConsentRecord).order_by(ConsentRecord.accepted_at.asc())):
        latest[c.student_id] = c
    ok_ids = [sid for sid, c in latest.items() if c.status == "active" and c.research_consent]
    if not ok_ids:
        return {}
    return {s.id: (s, latest[s.id]) for s in db.scalars(select(Student).where(Student.id.in_(ok_ids)))}


def _j(v) -> str:
    return json.dumps(v, ensure_ascii=False) if v is not None else ""


def _rows(db: Session, dataset: str, language: str | None, start: date | None, end: date | None):
    studs = consented_students(db)
    if dataset == "participants":
        header = ["participant_id", "consent_version", "consent_accepted_at", "audio_consent", "handwriting_consent", *SAFE_PROFILE]
        rows = [
            [s.participant_id, c.consent_version, c.accepted_at.isoformat(), c.audio_consent, c.handwriting_consent]
            + [(s.profile or {}).get(k, "") for k in SAFE_PROFILE]
            for s, c in studs.values()
        ]
        return header, rows

    model = ReadingAttempt if dataset == "reading" else WritingAttempt
    q = select(model).where(model.student_id.in_(list(studs) or [None]))
    if language:
        q = q.where(model.language == language)
    if start:
        q = q.where(model.client_created_at >= start)
    if end:
        q = q.where(model.client_created_at < end)
    q = q.order_by(model.client_created_at)

    if dataset == "reading":
        header = [
            "attempt_id",
            "participant_id",
            "created_at",
            "language",
            "level",
            "passage_id",
            "reference_text",
            "transcript",
            "asr_model_version",
            "asr_confidence",
            "duration_sec",
            "accuracy",
            "wpm",
            "wcpm",
            "pace",
            "substitutions",
            "omissions",
            "insertions",
            "practice_words",
            "aligned_words",
            "fluency",
            "analysis_version",
            "metrics_verified",
            "audio_sha256",
            "ai_status",
            "ai_model_version",
            "ai_prompt_version",
            "ai_feedback",
            "revision",
        ]
        rows = [
            [
                a.id,
                studs[a.student_id][0].participant_id,
                a.client_created_at.isoformat(),
                a.language,
                a.level,
                a.passage_id,
                a.reference_text,
                a.transcript,
                a.asr_model_version,
                a.asr_confidence,
                a.duration_sec,
                a.accuracy,
                a.wpm,
                a.wcpm,
                a.pace,
                a.substitutions,
                a.omissions,
                a.insertions,
                _j(a.practice_words),
                _j(a.aligned_words),
                _j(a.fluency),
                a.analysis_version,
                a.metrics_verified,
                a.audio_sha256,
                a.ai_status,
                a.ai_model_version,
                a.ai_prompt_version,
                _j(a.ai_feedback),
                a.revision,
            ]
            for a in db.scalars(q)
        ]
    else:
        header = [
            "attempt_id",
            "participant_id",
            "created_at",
            "language",
            "prompt_id",
            "input_method",
            "original_ocr",
            "ocr_confidence",
            "ocr_engine_version",
            "ocr_matches_server",
            "corrected_text",
            "word_count",
            "sentence_count",
            "grammar_score",
            "vocabulary_score",
            "spelling_score",
            "score",
            "image_sha256",
            "ai_status",
            "ai_model_version",
            "ai_prompt_version",
            "ai_feedback",
            "revision",
        ]
        rows = [
            [
                a.id,
                studs[a.student_id][0].participant_id,
                a.client_created_at.isoformat(),
                a.language,
                a.prompt_id,
                a.input_method,
                a.original_ocr,
                a.ocr_confidence,
                a.ocr_engine_version,
                a.ocr_matches_server,
                a.corrected_text,
                a.word_count,
                a.sentence_count,
                a.grammar_score,
                a.vocabulary_score,
                a.spelling_score,
                a.score,
                a.image_sha256,
                a.ai_status,
                a.ai_model_version,
                a.ai_prompt_version,
                _j(a.ai_feedback),
                a.revision,
            ]
            for a in db.scalars(q)
        ]
    return header, rows


@router.get("/export")
def export(
    dataset: Literal["reading", "writing", "participants"] = "reading",
    language: Literal["English", "Kannada"] | None = None,
    start: date | None = None,
    end: date | None = None,
    user: StaffUser = Depends(require_roles("researcher", "admin")),
    db: Session = Depends(get_db),
    _fmt: str = Query(default="csv", alias="format", pattern="^csv$"),
):
    header, rows = _rows(db, dataset, language, start, end)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    w.writerows(rows)
    # UTF-8 BOM so spreadsheet software shows Kannada text correctly.
    data = ("﻿" + buf.getvalue()).encode("utf-8")
    digest = hashlib.sha256(data).hexdigest()
    filters = {"language": language, "start": str(start) if start else None, "end": str(end) if end else None}
    db.add(ResearchExport(requested_by=user.id, dataset=dataset, filters=filters, row_count=len(rows), sha256=digest))
    audit(db, "staff", user.id, "research.export", "dataset", dataset, rows=len(rows), sha256=digest)
    name = f"vgyan-{dataset}-{date.today().isoformat()}.csv"
    return Response(
        content=data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"', "X-Content-SHA256": digest},
    )


@router.get("/summary")
def summary(user: StaffUser = Depends(require_roles("researcher", "admin")), db: Session = Depends(get_db)):
    studs = consented_students(db)
    ids = list(studs)
    r = db.scalars(select(ReadingAttempt).where(ReadingAttempt.student_id.in_(ids or [None]))).all()
    w = db.scalars(select(WritingAttempt).where(WritingAttempt.student_id.in_(ids or [None]))).all()
    return {
        "consentedParticipants": len(ids),
        "readingAttempts": len(r),
        "writingAttempts": len(w),
        "readingWithAudio": sum(1 for a in r if a.audio_key),
        "readingMetricsUnverified": sum(1 for a in r if a.metrics_verified is False),
        "writingFromImage": sum(1 for a in w if a.input_method != "typed"),
        "byLanguage": {
            lang: {"reading": sum(1 for a in r if a.language == lang), "writing": sum(1 for a in w if a.language == lang)}
            for lang in ("English", "Kannada")
        },
    }
