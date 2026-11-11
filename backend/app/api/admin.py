import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import hash_password
from app.db import get_db
from app.deps import require_roles
from app.models import (
    AiAssessment,
    ClassGroup,
    ConsentRecord,
    DeletionRequest,
    OcrRecord,
    ReadingAttempt,
    RecordRevision,
    School,
    StaffUser,
    Student,
    TeacherClass,
    TeacherComment,
    WritingAttempt,
)
from app.schemas import ClassIn, DeletionDecisionIn, SchoolIn, StaffIn
from app.services.audit import audit
from app.services.storage import get_storage

router = APIRouter(prefix="/admin", tags=["admin"])

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I confusion for children


def new_join_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))


@router.get("/schools")
def list_schools(user: StaffUser = Depends(require_roles("admin")), db: Session = Depends(get_db, scope="function")):
    return [{"id": str(s.id), "name": s.name, "district": s.district} for s in db.scalars(select(School).order_by(School.name))]


@router.post("/schools", status_code=201)
def create_school(body: SchoolIn, user: StaffUser = Depends(require_roles("admin")), db: Session = Depends(get_db, scope="function")):
    s = School(name=body.name.strip(), district=body.district)
    db.add(s)
    db.flush()
    audit(db, "staff", user.id, "admin.school_create", "school", s.id)
    return {"id": str(s.id), "name": s.name, "district": s.district}


@router.get("/classes")
def list_classes(user: StaffUser = Depends(require_roles("admin")), db: Session = Depends(get_db, scope="function")):
    return [
        {
            "id": str(c.id),
            "schoolId": str(c.school_id),
            "school": c.school.name,
            "grade": c.grade,
            "section": c.section,
            "joinCode": c.join_code,
        }
        for c in db.scalars(select(ClassGroup).order_by(ClassGroup.grade, ClassGroup.section))
    ]


@router.post("/classes", status_code=201)
def create_class(body: ClassIn, user: StaffUser = Depends(require_roles("admin")), db: Session = Depends(get_db, scope="function")):
    if not db.get(School, body.school_id):
        raise ApiError(404, "not_found", "School not found")
    section = body.section.strip().upper()
    if db.scalar(
        select(ClassGroup).where(ClassGroup.school_id == body.school_id, ClassGroup.grade == body.grade, ClassGroup.section == section)
    ):
        raise ApiError(409, "class_exists", "This class already exists")
    code = new_join_code()
    while db.scalar(select(ClassGroup.id).where(ClassGroup.join_code == code)):
        code = new_join_code()
    c = ClassGroup(school_id=body.school_id, grade=body.grade, section=section, join_code=code)
    db.add(c)
    db.flush()
    audit(db, "staff", user.id, "admin.class_create", "class", c.id)
    return {"id": str(c.id), "schoolId": str(c.school_id), "grade": c.grade, "section": c.section, "joinCode": c.join_code}


@router.get("/staff")
def list_staff(user: StaffUser = Depends(require_roles("admin")), db: Session = Depends(get_db, scope="function")):
    links: dict[uuid.UUID, list[str]] = {}
    for tc in db.scalars(select(TeacherClass)):
        links.setdefault(tc.staff_id, []).append(str(tc.class_id))
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "fullName": u.full_name,
            "role": u.role,
            "isActive": u.is_active,
            "classIds": links.get(u.id, []),
            "lastLoginAt": u.last_login_at.isoformat() if u.last_login_at else None,
        }
        for u in db.scalars(select(StaffUser).order_by(StaffUser.email))
    ]


@router.post("/staff", status_code=201)
def create_staff(body: StaffIn, user: StaffUser = Depends(require_roles("admin")), db: Session = Depends(get_db, scope="function")):
    email = body.email.strip().lower()
    if db.scalar(select(StaffUser.id).where(func.lower(StaffUser.email) == email)):
        raise ApiError(409, "staff_exists", "A staff account with this e-mail exists")
    u = StaffUser(
        email=email, full_name=body.full_name.strip(), password_hash=hash_password(body.password), role=body.role, school_id=body.school_id
    )
    db.add(u)
    db.flush()
    for cid in body.class_ids:
        if not db.get(ClassGroup, cid):
            raise ApiError(404, "not_found", f"Class {cid} not found")
        db.add(TeacherClass(staff_id=u.id, class_id=cid))
    audit(db, "staff", user.id, "admin.staff_create", "staff", u.id, role=u.role)
    return {"id": str(u.id), "email": u.email, "role": u.role, "classIds": [str(c) for c in body.class_ids]}


@router.put("/staff/{staff_id}/classes")
def set_staff_classes(
    staff_id: uuid.UUID,
    class_ids: list[uuid.UUID],
    user: StaffUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db, scope="function"),
):
    target = db.get(StaffUser, staff_id)
    if not target:
        raise ApiError(404, "not_found", "Staff member not found")
    db.execute(delete(TeacherClass).where(TeacherClass.staff_id == staff_id))
    for cid in class_ids:
        if not db.get(ClassGroup, cid):
            raise ApiError(404, "not_found", f"Class {cid} not found")
        db.add(TeacherClass(staff_id=staff_id, class_id=cid))
    audit(db, "staff", user.id, "admin.staff_classes", "staff", staff_id, classes=len(class_ids))
    return {"id": str(staff_id), "classIds": [str(c) for c in class_ids]}


@router.post("/staff/{staff_id}/deactivate", status_code=204)
def deactivate_staff(
    staff_id: uuid.UUID, user: StaffUser = Depends(require_roles("admin")), db: Session = Depends(get_db, scope="function")
):
    target = db.get(StaffUser, staff_id)
    if not target:
        raise ApiError(404, "not_found", "Staff member not found")
    if target.id == user.id:
        raise ApiError(422, "self_deactivate", "You cannot deactivate your own account")
    target.is_active = False
    target.token_version += 1
    audit(db, "staff", user.id, "admin.staff_deactivate", "staff", staff_id)


@router.get("/deletion-requests")
def list_deletion_requests(user: StaffUser = Depends(require_roles("admin")), db: Session = Depends(get_db, scope="function")):
    return [
        {
            "id": str(r.id),
            "participantId": r.student_id and db.get(Student, r.student_id).participant_id,
            "reason": r.reason,
            "status": r.status,
            "requestedAt": r.requested_at.isoformat(),
            "processedAt": r.processed_at.isoformat() if r.processed_at else None,
            "note": r.note,
        }
        for r in db.scalars(select(DeletionRequest).order_by(DeletionRequest.requested_at.desc()))
    ]


@router.post("/deletion-requests/{request_id}")
def process_deletion(
    request_id: uuid.UUID,
    body: DeletionDecisionIn,
    user: StaffUser = Depends(require_roles("admin")),
    db: Session = Depends(get_db, scope="function"),
):
    """Completing a request permanently removes the participant's attempts, revisions, AI/OCR records
    and stored media, and anonymises the account. Consent records are kept (with the guardian name
    redacted) as evidence that data was collected with consent and later withdrawn."""
    req = db.get(DeletionRequest, request_id)
    if not req:
        raise ApiError(404, "not_found", "Request not found")
    if req.status != "pending":
        raise ApiError(409, "already_processed", "This request has already been processed")
    req.processed_by = user.id
    req.processed_at = datetime.now(UTC)
    req.note = body.note
    if body.action == "reject":
        req.status = "rejected"
        audit(db, "staff", user.id, "admin.deletion_rejected", "deletion_request", req.id)
        return {"id": str(req.id), "status": req.status}

    sid = req.student_id
    storage = get_storage()
    keys: list[str] = []
    for a in db.scalars(select(ReadingAttempt).where(ReadingAttempt.student_id == sid)):
        keys += [a.audio_key] if a.audio_key else []
    for a in db.scalars(select(WritingAttempt).where(WritingAttempt.student_id == sid)):
        keys += [a.image_key] if a.image_key else []
    for o in db.scalars(select(OcrRecord).where(OcrRecord.student_id == sid)):
        keys += [o.image_key] if o.image_key else []
    keys += [r.file_key for r in db.scalars(select(RecordRevision).where(RecordRevision.student_id == sid)) if r.file_key]

    counts = {}
    for model in (RecordRevision, AiAssessment, ReadingAttempt, WritingAttempt, TeacherComment):
        counts[model.__tablename__] = db.execute(delete(model).where(model.student_id == sid)).rowcount
    # writing_attempts references ocr_records, so OCR rows go after the attempts.
    counts["ocr_records"] = db.execute(delete(OcrRecord).where(OcrRecord.student_id == sid)).rowcount
    for c in db.scalars(select(ConsentRecord).where(ConsentRecord.student_id == sid)):
        c.signer_name = "[deleted]"
        if c.status == "active":
            c.status = "withdrawn"
            c.withdrawn_at = datetime.now(UTC)
    s = db.get(Student, sid)
    s.full_name = "[deleted]"
    s.email = None
    s.profile = {}
    s.is_active = False
    s.token_version += 1
    s.password_hash = "!deleted"

    failed = 0
    for k in set(keys):
        try:
            storage.delete(k)
        except Exception:
            failed += 1
    req.status = "completed"
    audit(db, "staff", user.id, "admin.deletion_completed", "deletion_request", req.id, files=len(set(keys)), file_errors=failed, **counts)
    return {"id": str(req.id), "status": req.status, "deleted": counts, "filesDeleted": len(set(keys)) - failed, "fileErrors": failed}
