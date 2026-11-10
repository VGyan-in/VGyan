import unicodedata
import uuid
from collections import Counter, defaultdict
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.ratelimit import client_ip, limiter
from app.core.security import staff_token, verify_password
from app.db import get_db
from app.deps import assert_can_view_student, current_staff, require_roles, visible_class_ids
from app.models import (
    ClassGroup,
    ConsentRecord,
    ReadingAttempt,
    StaffUser,
    Student,
    TeacherClass,
    TeacherComment,
    WritingAttempt,
)
from app.schemas import PROFILE_KEYS, CommentIn, StaffLoginIn, TokenOut
from app.services.analysis import normalize_word
from app.services.audit import audit
from app.services.storage import get_storage

router = APIRouter(tags=["teacher"])

AT_RISK_ACCURACY = 75.0  # dashboard flag threshold, not a research classification

_DUMMY = "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0$Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFy"


@router.post("/auth/staff/login", response_model=TokenOut)
def staff_login(body: StaffLoginIn, request: Request, db: Session = Depends(get_db)):
    limiter.check(f"staff-login:{client_ip(request)}", 20, 300)
    email = body.email.strip().lower()
    limiter.check(f"staff-login-id:{email}", 8, 300)
    user = db.scalar(select(StaffUser).where(func.lower(StaffUser.email) == email))
    if not user or not user.is_active or not verify_password(body.password, user.password_hash if user else _DUMMY):
        raise ApiError(401, "invalid_credentials", "Incorrect e-mail or password")
    user.last_login_at = datetime.now(UTC)
    audit(db, "staff", user.id, "staff.login", "staff", user.id)
    return TokenOut(access_token=staff_token(user.id, user.role, user.token_version), role=user.role)  # type: ignore[arg-type]


@router.post("/auth/staff/logout-all", status_code=204)
def staff_logout_all(user: StaffUser = Depends(current_staff), db: Session = Depends(get_db)):
    user.token_version += 1
    audit(db, "staff", user.id, "staff.logout_all", "staff", user.id)


# ---------- helpers ----------


def _class_name(cg: ClassGroup | None) -> str | None:
    return f"Grade {cg.grade}{cg.section}" if cg else None


def _students_query(db: Session, user: StaffUser):
    q = select(Student).where(Student.is_active.is_(True))
    allowed = visible_class_ids(db, user)
    if allowed is not None:
        if not allowed:
            return None
        q = q.where(Student.class_id.in_(allowed))
    return q


def _latest_consents(db: Session, student_ids: list[uuid.UUID]) -> dict[uuid.UUID, ConsentRecord]:
    out: dict[uuid.UUID, ConsentRecord] = {}
    if not student_ids:
        return out
    for c in db.scalars(select(ConsentRecord).where(ConsentRecord.student_id.in_(student_ids)).order_by(ConsentRecord.accepted_at.asc())):
        out[c.student_id] = c
    return out


def reading_out(a: ReadingAttempt, s: Student) -> dict:
    fb = a.ai_feedback or {}
    return {
        "id": str(a.id),
        "participantId": s.participant_id,
        "studentId": str(s.id),
        "studentName": s.full_name,
        "date": a.client_created_at.isoformat(),
        "passageId": a.passage_id,
        "passageTitle": a.title or a.passage_id,
        "language": a.language,
        "level": a.level,
        "accuracy": a.accuracy,
        "wpm": a.wpm,
        "wcpm": a.wcpm,
        "pace": a.pace,
        "durationSeconds": a.duration_sec,
        "substitutions": a.substitutions,
        "omissions": a.omissions,
        "insertions": a.insertions,
        "referenceText": a.reference_text,
        "transcript": a.transcript,
        "words": a.aligned_words,
        "practiceWords": a.practice_words,
        "fluency": a.fluency,
        "asrModelVersion": a.asr_model_version,
        "asrConfidence": a.asr_confidence,
        "metricsVerified": a.metrics_verified,
        "hasAudio": bool(a.audio_key),
        "aiStatus": a.ai_status,
        "aiFeedback": fb or None,
        "aiModelVersion": a.ai_model_version,
        "aiPromptVersion": a.ai_prompt_version,
    }


def writing_out(a: WritingAttempt, s: Student) -> dict:
    fb = a.ai_feedback or {}
    return {
        "id": str(a.id),
        "participantId": s.participant_id,
        "studentId": str(s.id),
        "studentName": s.full_name,
        "date": a.client_created_at.isoformat(),
        "promptId": a.prompt_id,
        "promptTitle": a.prompt_text or a.prompt_id,
        "language": a.language,
        "inputMethod": a.input_method,
        "rawOcrText": a.original_ocr,
        "ocrConfidence": a.ocr_confidence,
        "ocrEngineVersion": a.ocr_engine_version,
        "ocrMatchesServer": a.ocr_matches_server,
        "studentCorrectedText": a.corrected_text,
        "hasImage": bool(a.image_key),
        "wordCount": a.word_count,
        "sentenceCount": a.sentence_count,
        "spellingErrorsCount": len(fb.get("misspelled") or []),
        "score": a.score,
        "grammarScore": a.grammar_score,
        "vocabularyScore": a.vocabulary_score,
        "spellingScore": a.spelling_score,
        "aiStatus": a.ai_status,
        "aiFeedback": fb or None,
        "aiModelVersion": a.ai_model_version,
        "aiPromptVersion": a.ai_prompt_version,
    }


def _avg(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 1) if xs else None


def student_summary(
    s: Student, readings: list[ReadingAttempt], writings: list[WritingAttempt], consent: ConsentRecord | None, recent: int = 10
) -> dict:
    readings = sorted(readings, key=lambda a: a.client_created_at, reverse=True)
    writings = sorted(writings, key=lambda a: a.client_created_at, reverse=True)
    last3 = [a.accuracy for a in readings[:3]]
    avg3 = _avg(last3)
    at_risk = avg3 is not None and avg3 < AT_RISK_ACCURACY
    dates = [a.client_created_at for a in readings[:1]] + [a.client_created_at for a in writings[:1]]
    scores = [a.score for a in writings if a.score is not None]
    cfg = get_settings()
    return {
        "studentId": str(s.id),
        "participantId": s.participant_id,
        "name": s.full_name,
        "classId": str(s.class_id) if s.class_id else None,
        "className": _class_name(s.class_group),
        "profile": {k: (s.profile or {}).get(k, "") for k in PROFILE_KEYS},
        "consentStatus": consent.status if consent else "pending",
        "consentVersion": consent.consent_version if consent else None,
        "consentCurrent": bool(consent and consent.status == "active" and consent.consent_version == cfg.consent_version),
        "lastAssessmentDate": max(dates).isoformat() if dates else None,
        "readingCount": len(readings),
        "writingCount": len(writings),
        "overallReadingAccuracy": _avg([a.accuracy for a in readings[:5]]),
        "averageWpm": _avg([a.wpm for a in readings[:5]]),
        "writingScore": _avg(scores[:5]),
        "isAtRisk": at_risk,
        "atRiskReason": f"Average accuracy {avg3}% over the last {len(last3)} readings is below {AT_RISK_ACCURACY:.0f}%"
        if at_risk
        else None,
        "recentReadingAttempts": [reading_out(a, s) for a in readings[:recent]],
        "recentWritingAttempts": [writing_out(a, s) for a in writings[:recent]],
    }


# ---------- endpoints ----------


@router.get("/teacher/me")
def me(user: StaffUser = Depends(current_staff), db: Session = Depends(get_db)):
    allowed = visible_class_ids(db, user)
    q = select(ClassGroup).order_by(ClassGroup.grade, ClassGroup.section)
    if allowed is not None:
        q = q.where(ClassGroup.id.in_(allowed)) if allowed else None
    classes = db.scalars(q).all() if q is not None else []
    counts = dict(db.execute(select(Student.class_id, func.count()).where(Student.is_active.is_(True)).group_by(Student.class_id)).all())
    return {
        "id": str(user.id),
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
        "school": user.school.name if user.school else "",
        "assignedClasses": [
            {
                "id": str(c.id),
                "name": _class_name(c),
                "grade": c.grade,
                "section": c.section,
                "joinCode": c.join_code,
                "school": c.school.name,
                "studentCount": counts.get(c.id, 0),
            }
            for c in classes
        ],
    }


@router.get("/teacher/students")
def students(
    class_id: uuid.UUID | None = Query(default=None, alias="classId"),
    user: StaffUser = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    q = _students_query(db, user)
    if q is None:
        return []
    if class_id:
        q = q.where(Student.class_id == class_id)
    studs = db.scalars(q.order_by(Student.full_name)).all()
    ids = [s.id for s in studs]
    readings: dict[uuid.UUID, list[ReadingAttempt]] = defaultdict(list)
    writings: dict[uuid.UUID, list[WritingAttempt]] = defaultdict(list)
    if ids:
        for a in db.scalars(select(ReadingAttempt).where(ReadingAttempt.student_id.in_(ids))):
            readings[a.student_id].append(a)
        for a in db.scalars(select(WritingAttempt).where(WritingAttempt.student_id.in_(ids))):
            writings[a.student_id].append(a)
    consents = _latest_consents(db, ids)
    audit(db, "staff", user.id, "teacher.list_students", "class", class_id, count=len(studs))
    return [student_summary(s, readings[s.id], writings[s.id], consents.get(s.id), recent=5) for s in studs]


@router.get("/teacher/students/{student_id}")
def student_detail(student_id: uuid.UUID, user: StaffUser = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db)):
    s = db.get(Student, student_id)
    if not s or not s.is_active:
        raise ApiError(404, "not_found", "Student not found")
    assert_can_view_student(db, user, s)
    readings = list(db.scalars(select(ReadingAttempt).where(ReadingAttempt.student_id == s.id)))
    writings = list(db.scalars(select(WritingAttempt).where(WritingAttempt.student_id == s.id)))
    consent = _latest_consents(db, [s.id]).get(s.id)
    audit(db, "staff", user.id, "teacher.view_student", "student", s.id)
    return student_summary(s, readings, writings, consent, recent=500)


@router.get("/teacher/reading/{attempt_id}/audio")
def reading_audio(attempt_id: uuid.UUID, user: StaffUser = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db)):
    a = db.get(ReadingAttempt, attempt_id)
    if not a or not a.audio_key:
        raise ApiError(404, "not_found", "Recording not found")
    assert_can_view_student(db, user, a.student)
    ttl = get_settings().signed_url_ttl_seconds
    audit(db, "staff", user.id, "media.audio_url", "reading_attempt", a.id)
    return {"url": get_storage().signed_url(a.audio_key, ttl), "expiresIn": ttl, "mime": a.audio_mime}


@router.get("/teacher/writing/{attempt_id}/image")
def writing_image(attempt_id: uuid.UUID, user: StaffUser = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db)):
    a = db.get(WritingAttempt, attempt_id)
    if not a or not a.image_key:
        raise ApiError(404, "not_found", "Image not found")
    assert_can_view_student(db, user, a.student)
    ttl = get_settings().signed_url_ttl_seconds
    audit(db, "staff", user.id, "media.image_url", "writing_attempt", a.id)
    return {"url": get_storage().signed_url(a.image_key, ttl), "expiresIn": ttl, "mime": a.image_mime}


@router.get("/teacher/missed-words")
def missed_words(
    language: str | None = None,
    limit: int = Query(default=30, ge=1, le=200),
    user: StaffUser = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    q = _students_query(db, user)
    if q is None:
        return []
    ids = [s.id for s in db.scalars(q)]
    if not ids:
        return []
    rq = select(ReadingAttempt).where(ReadingAttempt.student_id.in_(ids))
    if language:
        rq = rq.where(ReadingAttempt.language == language)
    freq: Counter = Counter()
    kinds: dict[tuple, Counter] = defaultdict(Counter)
    subs: dict[tuple, Counter] = defaultdict(Counter)
    students_by: dict[tuple, set] = defaultdict(set)
    display: dict[tuple, str] = {}
    for a in db.scalars(rq):
        for w in a.aligned_words or []:
            if w.get("status") not in ("substitution", "omission") or not w.get("ref"):
                continue
            key = (a.language, normalize_word(w["ref"]))
            if not key[1]:
                continue
            display.setdefault(key, "".join(ch for ch in w["ref"] if unicodedata.category(ch)[0] in "LMN"))
            freq[key] += 1
            kinds[key][w["status"]] += 1
            students_by[key].add(a.student_id)
            if w["status"] == "substitution" and w.get("hyp"):
                subs[key][w["hyp"]] += 1
    return [
        {
            "word": display[k] or k[1],
            "language": k[0],
            "frequency": n,
            "primaryError": kinds[k].most_common(1)[0][0],
            "commonSubstitutions": [h for h, _ in subs[k].most_common(3)],
            "affectedStudentsCount": len(students_by[k]),
        }
        for k, n in freq.most_common(limit)
    ]


@router.get("/teacher/comments")
def list_comments(
    student_id: uuid.UUID | None = Query(default=None, alias="studentId"),
    user: StaffUser = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    q = _students_query(db, user)
    if q is None:
        return []
    visible = {s.id: s for s in db.scalars(q)}
    cq = select(TeacherComment).where(TeacherComment.student_id.in_(list(visible) or [uuid.uuid4()]))
    if student_id:
        cq = cq.where(TeacherComment.student_id == student_id)
    authors = {u.id: u.full_name for u in db.scalars(select(StaffUser))}
    return [
        {
            "id": str(c.id),
            "studentId": str(c.student_id),
            "studentName": visible[c.student_id].full_name,
            "author": authors.get(c.author_id, ""),
            "text": c.text,
            "category": c.category,
            "timestamp": c.created_at.isoformat(),
        }
        for c in db.scalars(cq.order_by(TeacherComment.created_at.desc()).limit(500))
    ]


@router.post("/teacher/comments", status_code=201)
def add_comment(body: CommentIn, user: StaffUser = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db)):
    s = db.get(Student, body.student_id)
    if not s:
        raise ApiError(404, "not_found", "Student not found")
    assert_can_view_student(db, user, s)
    c = TeacherComment(student_id=s.id, author_id=user.id, text=body.text.strip(), category=body.category)
    db.add(c)
    db.flush()
    audit(db, "staff", user.id, "teacher.comment", "student", s.id)
    return {
        "id": str(c.id),
        "studentId": str(s.id),
        "studentName": s.full_name,
        "author": user.full_name,
        "text": c.text,
        "category": c.category,
        "timestamp": c.created_at.isoformat(),
    }


@router.get("/teacher/analytics")
def analytics(
    class_id: uuid.UUID | None = Query(default=None, alias="classId"),
    user: StaffUser = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Class-level trends computed from stored attempts only."""
    q = _students_query(db, user)
    empty = {"students": 0, "weekly": [], "byLanguageLevel": [], "completion": {}}
    if q is None:
        return empty
    if class_id:
        q = q.where(Student.class_id == class_id)
    studs = db.scalars(q).all()
    ids = [s.id for s in studs]
    if not ids:
        return empty
    readings = db.scalars(select(ReadingAttempt).where(ReadingAttempt.student_id.in_(ids))).all()
    writings = db.scalars(select(WritingAttempt).where(WritingAttempt.student_id.in_(ids))).all()

    weekly: dict[str, dict] = defaultdict(lambda: {"reading": 0, "writing": 0, "acc": [], "wpm": [], "score": []})
    for a in readings:
        y, w, _ = a.client_created_at.isocalendar()
        b = weekly[f"{y}-W{w:02d}"]
        b["reading"] += 1
        b["acc"].append(a.accuracy)
        b["wpm"].append(a.wpm)
    for a in writings:
        y, w, _ = a.client_created_at.isocalendar()
        b = weekly[f"{y}-W{w:02d}"]
        b["writing"] += 1
        if a.score is not None:
            b["score"].append(a.score)

    groups: dict[tuple, list[ReadingAttempt]] = defaultdict(list)
    for a in readings:
        groups[(a.language, a.level)].append(a)

    read_any = {a.student_id for a in readings}
    write_any = {a.student_id for a in writings}
    langs = {(a.student_id, a.language) for a in readings}
    return {
        "students": len(ids),
        "weekly": [
            {
                "week": k,
                "readingCount": v["reading"],
                "writingCount": v["writing"],
                "avgAccuracy": _avg(v["acc"]),
                "avgWpm": _avg(v["wpm"]),
                "avgWritingScore": _avg(v["score"]),
            }
            for k, v in sorted(weekly.items())
        ],
        "byLanguageLevel": [
            {
                "language": lang,
                "level": lvl,
                "attempts": len(v),
                "avgAccuracy": _avg([a.accuracy for a in v]),
                "avgWpm": _avg([a.wpm for a in v]),
                "avgSubstitutions": _avg([a.substitutions for a in v]),
                "avgOmissions": _avg([a.omissions for a in v]),
                "avgInsertions": _avg([a.insertions for a in v]),
            }
            for (lang, lvl), v in sorted(groups.items())
        ],
        "completion": {
            "readingAny": len(read_any),
            "writingAny": len(write_any),
            "both": len(read_any & write_any),
            "englishReading": len({s for s, lang in langs if lang == "English"}),
            "kannadaReading": len({s for s, lang in langs if lang == "Kannada"}),
            "none": len(set(ids) - read_any - write_any),
        },
        "unverifiedMetrics": sum(1 for a in readings if a.metrics_verified is False),
    }


@router.get("/teacher/classes/{class_id}/teachers")
def class_teachers(class_id: uuid.UUID, user: StaffUser = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.execute(
        select(StaffUser).join(TeacherClass, TeacherClass.staff_id == StaffUser.id).where(TeacherClass.class_id == class_id)
    ).scalars()
    return [{"id": str(u.id), "name": u.full_name, "email": u.email} for u in rows]
