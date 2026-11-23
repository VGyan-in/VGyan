"""Operator commands.

python -m app.cli create-admin --email admin@school.org --name "Admin Name"
    Password is read from VGYAN_ADMIN_PASSWORD, or a random one is generated and printed once.

python -m app.cli purge-storage
    Retries stored-object deletions queued by completed deletion requests (exit 1 if any remain).

python -m app.cli integrity-check
    Cross-checks database and object storage: missing or orphaned media, data left behind by a
    deletion, attempts without a consent record. Prints JSON; exit 1 if any problem is found.
"""

import argparse
import json
import os
import secrets
import sys

from sqlalchemy import func, select

from app.core.security import hash_password
from app.db import session_factory
from app.models import StaffUser


def create_admin(email: str, name: str) -> int:
    password = os.environ.get("VGYAN_ADMIN_PASSWORD") or secrets.token_urlsafe(14)
    with session_factory()() as db:
        if db.scalar(select(StaffUser).where(func.lower(StaffUser.email) == email.lower())):
            print(f"Staff account {email} already exists; nothing changed.")
            return 0
        db.add(StaffUser(email=email.lower(), full_name=name, password_hash=hash_password(password), role="admin"))
        db.commit()
    print(f"Created admin {email}.")
    if not os.environ.get("VGYAN_ADMIN_PASSWORD"):
        print(f"Temporary password (shown once): {password}")
    return 0


def purge_storage() -> int:
    from app.services.deletion import purge_pending
    from app.services.storage import get_storage

    with session_factory()() as db:
        result = purge_pending(db, get_storage(), limit=10_000)
        db.commit()
    print(json.dumps(result))
    return 1 if result["failed"] else 0


def integrity_check() -> int:
    from app.services.integrity import run_integrity_check
    from app.services.storage import get_storage

    with session_factory()() as db:
        report = run_integrity_check(db, get_storage())
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="app.cli")
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("create-admin")
    c.add_argument("--email", required=True)
    c.add_argument("--name", required=True)
    sub.add_parser("purge-storage")
    sub.add_parser("integrity-check")
    args = p.parse_args(argv)
    if args.cmd == "create-admin":
        return create_admin(args.email, args.name)
    if args.cmd == "purge-storage":
        return purge_storage()
    if args.cmd == "integrity-check":
        return integrity_check()
    return 1


if __name__ == "__main__":
    sys.exit(main())
