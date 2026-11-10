import uuid
from collections.abc import Callable

import jwt
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import decode_token
from app.db import get_db
from app.models import ClassGroup, StaffUser, Student, TeacherClass


def _bearer(authorization: str | None) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "unauthorized", "Sign in required")
    try:
        return decode_token(authorization.split(" ", 1)[1].strip())
    except jwt.ExpiredSignatureError as e:
        raise ApiError(401, "token_expired", "Session expired. Please sign in again.") from e
    except jwt.PyJWTError as e:
        raise ApiError(401, "unauthorized", "Invalid session") from e


def current_student(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Student:
    claims = _bearer(authorization)
    if claims.get("role") != "student":
        raise ApiError(403, "forbidden", "Student account required")
    student = db.get(Student, uuid.UUID(claims["sub"]))
    if not student or not student.is_active or student.token_version != claims.get("ver"):
        raise ApiError(401, "unauthorized", "Invalid session")
    return student


def current_staff(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> StaffUser:
    claims = _bearer(authorization)
    if claims.get("role") not in ("teacher", "researcher", "admin"):
        raise ApiError(403, "forbidden", "Staff account required")
    user = db.get(StaffUser, uuid.UUID(claims["sub"]))
    if not user or not user.is_active or user.token_version != claims.get("ver") or user.role != claims["role"]:
        raise ApiError(401, "unauthorized", "Invalid session")
    return user


def require_roles(*roles: str) -> Callable[..., StaffUser]:
    def dep(user: StaffUser = Depends(current_staff)) -> StaffUser:
        if user.role not in roles:
            raise ApiError(403, "forbidden", "You do not have access to this resource")
        return user

    return dep


def visible_class_ids(db: Session, user: StaffUser) -> list[uuid.UUID] | None:
    """Classes whose students this staff member may see by name. None means all (admin).
    Teachers see their assigned classes only. Researchers see no identifiable student records."""
    if user.role == "admin":
        return None
    if user.role == "teacher":
        return list(db.scalars(select(TeacherClass.class_id).where(TeacherClass.staff_id == user.id)))
    return []


def assert_can_view_student(db: Session, user: StaffUser, student: Student) -> None:
    allowed = visible_class_ids(db, user)
    if allowed is None:
        return
    if student.class_id is None or student.class_id not in allowed:
        # 404, not 403: do not reveal whether a student exists outside the teacher's classes.
        raise ApiError(404, "not_found", "Student not found")


def class_by_code(db: Session, code: str | None) -> ClassGroup | None:
    if not code or not code.strip():
        return None
    cg = db.scalar(select(ClassGroup).where(ClassGroup.join_code == code.strip().upper()))
    if not cg:
        raise ApiError(422, "invalid_class_code", "Class code not found. Check it with your teacher.")
    return cg
