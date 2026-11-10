import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.ratelimit import client_ip, limiter
from app.core.security import hash_password, student_token, verify_password
from app.db import get_db
from app.deps import class_by_code, current_student
from app.models import Assignment, ConsentRecord, DeletionRequest, Passage, ReadingAttempt, Student, WritingAttempt
from app.schemas import (
    PROFILE_KEYS,
    DeletionRequestIn,
    StudentLoginIn,
    StudentProfileIn,
    StudentRegisterIn,
    TokenOut,
)
from app.services.audit import audit

router = APIRouter(prefix="/student", tags=["student"])

_DUMMY_HASH = hash_password("timing-equaliser-not-a-password")


def new_participant_id() -> str:
    # VG-<year>-<6 random digits>; uniqueness is enforced by the database constraint.
    return f"VG-{datetime.now(UTC).year}-{secrets.randbelow(900000) + 100000}"


def student_profile_out(s: Student) -> dict:
    cg = s.class_group
    return {
        "studentId": str(s.id),
        "participantId": s.participant_id,
        "name": s.full_name,
        "email": s.email or "",
        **{k: str(s.profile.get(k, "") or "") for k in PROFILE_KEYS},
        "classId": str(cg.id) if cg else None,
        "className": f"Grade {cg.grade}{cg.section}" if cg else None,
        "createdAt": s.created_at.isoformat(),
        "updatedAt": s.updated_at.isoformat(),
    }


@router.post("/register", status_code=201, response_model=TokenOut)
def register(body: StudentRegisterIn, request: Request, db: Session = Depends(get_db)):
    limiter.check(f"register:{client_ip(request)}", 10, 3600)
    if not get_settings().allow_student_registration:
        raise ApiError(403, "registration_closed", "Registration is closed. Ask your teacher for an account.")
    cg = class_by_code(db, body.class_code)
    pid = body.student_id or new_participant_id()
    if db.scalar(select(Student.id).where(Student.participant_id == pid)):
        raise ApiError(409, "participant_exists", "This participant ID is already registered")
    if body.email and db.scalar(select(Student.id).where(func.lower(Student.email) == body.email)):
        raise ApiError(409, "email_exists", "This e-mail is already registered")
    student = Student(
        participant_id=pid,
        full_name=body.full_name.strip(),
        email=body.email,
        password_hash=hash_password(body.password),
        class_id=cg.id if cg else None,
        profile={},
    )
    db.add(student)
    try:
        db.flush()
    except IntegrityError as e:
        raise ApiError(409, "participant_exists", "This participant ID is already registered") from e
    audit(db, "student", student.id, "student.register", "student", student.id)
    return TokenOut(access_token=student_token(student.id, student.token_version), participant_id=pid, role="student")


@router.post("/login", response_model=TokenOut)
def login(body: StudentLoginIn, request: Request, db: Session = Depends(get_db)):
    ident = body.student_id.strip()
    limiter.check(f"student-login:{client_ip(request)}", 30, 300)
    limiter.check(f"student-login-id:{ident.lower()}", 10, 300)
    student = db.scalar(select(Student).where(or_(Student.participant_id == ident.upper(), func.lower(Student.email) == ident.lower())))
    if not student:
        verify_password(body.password, _DUMMY_HASH)  # keep response time independent of existence
        raise ApiError(404, "not_found", "No account with this participant ID")
    if not student.is_active or not verify_password(body.password, student.password_hash):
        raise ApiError(401, "wrong_password", "Incorrect password")
    student.last_login_at = datetime.now(UTC)
    audit(db, "student", student.id, "student.login", "student", student.id)
    return TokenOut(
        access_token=student_token(student.id, student.token_version),
        participant_id=student.participant_id,
        role="student",
    )


@router.get("/me")
def me(student: Student = Depends(current_student)):
    return student_profile_out(student)


@router.patch("/me")
def update_me(body: StudentProfileIn, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    data = body.model_dump(by_alias=True, exclude_unset=True)
    if "classCode" in data:
        cg = class_by_code(db, data.pop("classCode"))
        if cg:
            student.class_id = cg.id
    if data.get("name"):
        student.full_name = data.pop("name").strip()
    data.pop("name", None)
    profile = dict(student.profile or {})
    for k in PROFILE_KEYS:
        if k in data and data[k] is not None:
            profile[k] = data[k]
    student.profile = profile
    db.flush()
    db.refresh(student)
    return student_profile_out(student)


@router.post("/logout-all", status_code=204)
def logout_all(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    student.token_version += 1
    audit(db, "student", student.id, "student.logout_all", "student", student.id)


def _reading_out(a: ReadingAttempt) -> dict:
    return {
        "id": str(a.id),
        "passageId": a.passage_id,
        "title": a.title,
        "language": a.language,
        "level": a.level,
        "createdAt": a.client_created_at.isoformat(),
        "asrStatus": a.asr_status,
        "accuracy": a.accuracy,
        "wpm": a.wpm,
        "wcpm": a.wcpm,
        "pace": a.pace,
        "mistakesCount": a.mistakes,
        "substitutions": a.substitutions,
        "omissions": a.omissions,
        "insertions": a.insertions,
        "practiceWords": a.practice_words,
        "aiStatus": a.ai_status,
        "feedback": a.ai_feedback,
    }


def _writing_out(a: WritingAttempt) -> dict:
    return {
        "id": str(a.id),
        "promptId": a.prompt_id,
        "prompt": a.prompt_text,
        "language": a.language,
        "inputMethod": a.input_method,
        "createdAt": a.client_created_at.isoformat(),
        "wordCount": a.word_count,
        "sentenceCount": a.sentence_count,
        "score": a.score,
        "grammarScore": a.grammar_score,
        "vocabularyScore": a.vocabulary_score,
        "spellingScore": a.spelling_score,
        "aiStatus": a.ai_status,
        "assessment": a.ai_feedback,
    }


@router.get("/my_report")
def my_report(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    """Everything the server holds for this student's progress screens (e.g. after changing phones)."""
    readings = db.scalars(
        select(ReadingAttempt).where(ReadingAttempt.student_id == student.id).order_by(ReadingAttempt.client_created_at.desc())
    ).all()
    writings = db.scalars(
        select(WritingAttempt).where(WritingAttempt.student_id == student.id).order_by(WritingAttempt.client_created_at.desc())
    ).all()
    consent = db.scalar(select(ConsentRecord).where(ConsentRecord.student_id == student.id).order_by(ConsentRecord.accepted_at.desc()))
    return {
        "participantId": student.participant_id,
        "profile": student_profile_out(student),
        "consent": None
        if not consent
        else {"status": consent.status, "consentVersion": consent.consent_version, "acceptedAt": consent.accepted_at.isoformat()},
        "reading": [_reading_out(a) for a in readings],
        "writing": [_writing_out(a) for a in writings],
    }


def passage_out(p: Passage) -> dict:
    return {
        "id": p.id,
        "kind": p.kind,
        "language": p.language,
        "level": p.level,
        "title": p.title,
        "kannadaTitle": p.kannada_title,
        "text": p.text,
        "kannadaText": p.kannada_text,
        "minWords": p.min_words,
        "hint": p.hint,
        "kannadaHint": p.kannada_hint,
        "gradeMin": p.grade_min,
        "gradeMax": p.grade_max,
        "version": p.version,
        "isActive": p.is_active,
        "updatedAt": p.updated_at.isoformat(),
    }


@router.get("/assignments")
def assignments(student: Student = Depends(current_student), db: Session = Depends(get_db)):
    """Active passages and prompts for offline caching, plus which ones the student's class was assigned."""
    passages = db.scalars(select(Passage).where(Passage.is_active.is_(True)).order_by(Passage.id)).all()
    assigned: dict[str, str | None] = {}
    if student.class_id:
        for a in db.scalars(select(Assignment).where(Assignment.class_id == student.class_id)):
            assigned[a.passage_id] = a.due_at.isoformat() if a.due_at else None
    return {"passages": [{**passage_out(p), "assigned": p.id in assigned, "dueAt": assigned.get(p.id)} for p in passages]}


@router.post("/me/deletion-request", status_code=202)
def request_deletion(body: DeletionRequestIn, student: Student = Depends(current_student), db: Session = Depends(get_db)):
    """Records a request to delete this participant's research data. An administrator processes it
    according to the approved retention protocol; nothing is deleted silently."""
    existing = db.scalar(select(DeletionRequest).where(DeletionRequest.student_id == student.id, DeletionRequest.status == "pending"))
    if existing:
        return {"id": str(existing.id), "status": existing.status}
    req = DeletionRequest(student_id=student.id, reason=body.reason.strip())
    db.add(req)
    db.flush()
    audit(db, "student", student.id, "student.deletion_requested", "deletion_request", req.id)
    return {"id": str(req.id), "status": req.status}
