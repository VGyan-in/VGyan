"""Operator commands.

python -m app.cli create-admin --email admin@school.org --name "Admin Name"
    Password is read from VGYAN_ADMIN_PASSWORD, or a random one is generated and printed once.
"""

import argparse
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


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="app.cli")
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("create-admin")
    c.add_argument("--email", required=True)
    c.add_argument("--name", required=True)
    args = p.parse_args(argv)
    if args.cmd == "create-admin":
        return create_admin(args.email, args.name)
    return 1


if __name__ == "__main__":
    sys.exit(main())
