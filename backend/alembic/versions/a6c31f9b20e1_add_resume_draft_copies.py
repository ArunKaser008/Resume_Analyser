"""add draft changes and bounded resume copies

Revision ID: a6c31f9b20e1
Revises: d14b2d8af441
Create Date: 2026-11-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a6c31f9b20e1"
down_revision: Union[str, Sequence[str], None] = "d14b2d8af441"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "resumes",
        sa.Column(
            "parent_resume_id",
            sa.Uuid(),
            sa.ForeignKey("resumes.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_resumes_parent_resume_id",
        "resumes",
        ["parent_resume_id"],
    )
    op.alter_column(
        "resume_content_overrides",
        "suggestion_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )
    op.add_column(
        "resume_content_overrides",
        sa.Column(
            "is_draft",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column(
        "resume_content_overrides",
        sa.Column("previous_content", sa.Text(), nullable=True),
    )
    op.add_column(
        "resume_content_overrides",
        sa.Column(
            "draft_created",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("resume_content_overrides", "draft_created")
    op.drop_column("resume_content_overrides", "previous_content")
    op.drop_column("resume_content_overrides", "is_draft")
    op.alter_column(
        "resume_content_overrides",
        "suggestion_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )
    op.drop_index("ix_resumes_parent_resume_id", table_name="resumes")
    op.drop_column("resumes", "parent_resume_id")
