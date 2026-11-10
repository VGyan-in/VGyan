import logging
import uuid

from sqlalchemy.orm import Session

from app.models import AuditLog

log = logging.getLogger("vgyan.audit")


def audit(
    db: Session,
    actor_type: str,
    actor_id: uuid.UUID | None,
    action: str,
    target_type: str | None = None,
    target_id: str | uuid.UUID | None = None,
    **details,
) -> None:
    """Record an access or change. `details` must never contain names, text or other student content."""
    db.add(
        AuditLog(
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            details=details,
        )
    )
    log.info("audit action=%s actor=%s:%s target=%s:%s", action, actor_type, actor_id, target_type, target_id)
