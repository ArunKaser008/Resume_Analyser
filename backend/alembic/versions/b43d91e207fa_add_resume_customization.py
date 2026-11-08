"""add resume custom sections and design settings

Revision ID: b43d91e207fa
Revises: a6c31f9b20e1
Create Date: 2026-11-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b43d91e207fa"
down_revision: Union[str, Sequence[str], None] = "a6c31f9b20e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "resumes",
        sa.Column(
            "custom_sections",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
    )
    op.add_column(
        "resumes",
        sa.Column(
            "design_settings",
            sa.JSON(),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
    )
    op.add_column(
        "resumes",
        sa.Column(
            "section_order",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("resumes", "section_order")
    op.drop_column("resumes", "design_settings")
    op.drop_column("resumes", "custom_sections")
