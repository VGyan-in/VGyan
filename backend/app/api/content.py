import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.student import passage_out
from app.core.errors import ApiError
from app.db import get_db
from app.deps import current_staff, require_roles, visible_class_ids
from app.models import Assignment, ClassGroup, Passage, StaffUser
from app.schemas import AssignmentIn, PassageIn
from app.services.audit import audit

router = APIRouter(tags=["passages"])

_TEXT_FIELDS = ("text", "kannada_text", "title", "kannada_title", "language", "level", "kind", "min_words")


@router.get("/passages")
def list_passages(user: StaffUser = Depends(current_staff), db: Session = Depends(get_db)):
    return [passage_out(p) for p in db.scalars(select(Passage).order_by(Passage.kind, Passage.language, Passage.id))]


@router.post("/passages", status_code=201)
def create_passage(body: PassageIn, user: StaffUser = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db)):
    if db.get(Passage, body.id):
        raise ApiError(409, "passage_exists", "A passage with this ID already exists")
    if body.kind == "reading" and not body.level:
        raise ApiError(422, "level_required", "Reading passages need a level")
    p = Passage(**body.model_dump(), created_by=user.id)
    db.add(p)
    db.flush()
    audit(db, "staff", user.id, "passage.create", "passage", p.id)
    return passage_out(p)


@router.put("/passages/{passage_id}")
def update_passage(
    passage_id: str, body: PassageIn, user: StaffUser = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db)
):
    p = db.get(Passage, passage_id)
    if not p:
        raise ApiError(404, "not_found", "Passage not found")
    if body.id != passage_id:
        raise ApiError(422, "id_mismatch", "Passage ID cannot change")
    data = body.model_dump()
    # Any change to what students read bumps the version; attempts keep their own copy of the text.
    if any(getattr(p, f) != data[f] for f in _TEXT_FIELDS):
        p.version += 1
    for k, v in data.items():
        setattr(p, k, v)
    db.flush()
    audit(db, "staff", user.id, "passage.update", "passage", p.id, version=p.version)
    return passage_out(p)


@router.get("/assignments")
def list_assignments(user: StaffUser = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db)):
    q = select(Assignment).order_by(Assignment.created_at.desc())
    allowed = visible_class_ids(db, user)
    if allowed is not None:
        q = q.where(Assignment.class_id.in_(allowed or [uuid.uuid4()]))
    return [
        {
            "id": str(a.id),
            "passageId": a.passage_id,
            "classId": str(a.class_id),
            "dueAt": a.due_at.isoformat() if a.due_at else None,
            "createdAt": a.created_at.isoformat(),
        }
        for a in db.scalars(q)
    ]


@router.post("/assignments", status_code=201)
def create_assignment(body: AssignmentIn, user: StaffUser = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db)):
    allowed = visible_class_ids(db, user)
    if allowed is not None and body.class_id not in allowed:
        raise ApiError(404, "not_found", "Class not found")
    if not db.get(ClassGroup, body.class_id) or not db.get(Passage, body.passage_id):
        raise ApiError(404, "not_found", "Class or passage not found")
    existing = db.scalar(select(Assignment).where(Assignment.class_id == body.class_id, Assignment.passage_id == body.passage_id))
    if existing:
        existing.due_at = body.due_at
        a = existing
    else:
        a = Assignment(passage_id=body.passage_id, class_id=body.class_id, due_at=body.due_at, assigned_by=user.id)
        db.add(a)
    db.flush()
    audit(db, "staff", user.id, "assignment.set", "class", body.class_id, passage=body.passage_id)
    return {"id": str(a.id), "passageId": a.passage_id, "classId": str(a.class_id), "dueAt": a.due_at.isoformat() if a.due_at else None}


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: uuid.UUID, user: StaffUser = Depends(require_roles("teacher", "admin")), db: Session = Depends(get_db)
):
    a = db.get(Assignment, assignment_id)
    allowed = visible_class_ids(db, user)
    if not a or (allowed is not None and a.class_id not in allowed):
        raise ApiError(404, "not_found", "Assignment not found")
    db.delete(a)
    audit(db, "staff", user.id, "assignment.delete", "class", a.class_id, passage=a.passage_id)
