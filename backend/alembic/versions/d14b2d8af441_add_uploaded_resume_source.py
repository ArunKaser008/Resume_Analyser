"""add uploaded resume source text

Revision ID: d14b2d8af441
Revises: 7d8fd7605fd9
Create Date: 2026-11-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d14b2d8af441"
down_revision: Union[str, Sequence[str], None] = "7d8fd7605fd9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "resumes",
        sa.Column("source_filename", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "resumes",
        sa.Column("source_text", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("resumes", "source_text")
    op.drop_column("resumes", "source_filename")
