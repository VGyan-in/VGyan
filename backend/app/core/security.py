import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()

Role = Literal["student", "teacher", "researcher", "admin"]
STAFF_ROLES = ("teacher", "researcher", "admin")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        return _hasher.verify(stored, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def create_token(subject: uuid.UUID, role: Role, token_version: int, ttl: timedelta, extra: dict | None = None) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(subject),
        "role": role,
        # Bumping the stored token_version (password change, deactivation, "sign out everywhere")
        # invalidates every token issued before it.
        "ver": token_version,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
        "jti": uuid.uuid4().hex,
        **(extra or {}),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_token(token: str) -> dict:
    s = get_settings()
    return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm], options={"require": ["exp", "sub", "role"]})


def student_token(student_id: uuid.UUID, token_version: int) -> str:
    return create_token(student_id, "student", token_version, timedelta(days=get_settings().student_token_ttl_days))


def staff_token(staff_id: uuid.UUID, role: Role, token_version: int) -> str:
    return create_token(staff_id, role, token_version, timedelta(hours=get_settings().staff_token_ttl_hours))


def file_token(object_key: str, ttl_seconds: int) -> str:
    """Short-lived token for downloading one stored object (local storage backend only)."""
    s = get_settings()
    now = datetime.now(UTC)
    return jwt.encode(
        {"key": object_key, "typ": "file", "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp())},
        s.jwt_secret,
        algorithm=s.jwt_algorithm,
    )


def decode_file_token(token: str) -> str:
    s = get_settings()
    data = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    if data.get("typ") != "file":
        raise jwt.InvalidTokenError("not a file token")
    return str(data["key"])
