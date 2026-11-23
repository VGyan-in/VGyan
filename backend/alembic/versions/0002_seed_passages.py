"""seed bundled passages and writing prompts

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-10
"""

from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    from app.seed_data import rows

    passages = sa.table(
        "passages",
        sa.column("id", sa.String),
        sa.column("kind", sa.String),
        sa.column("language", sa.String),
        sa.column("level", sa.String),
        sa.column("title", sa.String),
        sa.column("kannada_title", sa.String),
        sa.column("text", sa.Text),
        sa.column("kannada_text", sa.Text),
        sa.column("min_words", sa.Integer),
        sa.column("hint", sa.Text),
        sa.column("kannada_hint", sa.Text),
        sa.column("version", sa.Integer),
        sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(UTC)
    data = [{**r, "version": 1, "is_active": True, "created_at": now, "updated_at": now} for r in rows()]
    # Never overwrite passages a teacher may already have edited.
    op.execute(insert(passages).values(data).on_conflict_do_nothing(index_elements=["id"]))


def downgrade() -> None:
    # Seeded passages may be referenced by attempts and assignments; leave them in place.
    pass
