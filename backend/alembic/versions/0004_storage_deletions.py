"""storage deletion queue, revision index

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "storage_deletions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("object_key", sa.String(length=400), nullable=False),
        sa.Column("reason", sa.String(length=60), nullable=False),
        sa.Column("deletion_request_id", sa.UUID(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_error", sa.String(length=200), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["deletion_request_id"], ["deletion_requests.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key"),
    )
    op.create_index("ix_storage_deletion_open", "storage_deletions", ["completed_at"], unique=False)
    op.create_index("ix_revision_student", "record_revisions", ["student_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_revision_student", table_name="record_revisions")
    op.drop_index("ix_storage_deletion_open", table_name="storage_deletions")
    op.drop_table("storage_deletions")
