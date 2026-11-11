"""add LeetCode profile link

Revision ID: f37c4a281b9d
Revises: b43d91e207fa
Create Date: 2026-11-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f37c4a281b9d"
down_revision: Union[str, Sequence[str], None] = "b43d91e207fa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "career_profiles",
        sa.Column("leetcode_url", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("career_profiles", "leetcode_url")
