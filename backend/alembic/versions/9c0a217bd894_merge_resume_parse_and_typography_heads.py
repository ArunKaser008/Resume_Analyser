"""Merge resume parsing and typography migration heads.

Revision ID: 9c0a217bd894
Revises: c2a809f0d44b, f1c6a5e239b7
Create Date: 2026-11-12
"""

from typing import Sequence, Union


revision: str = "9c0a217bd894"
down_revision: Union[str, Sequence[str], None] = (
    "c2a809f0d44b",
    "f1c6a5e239b7",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    return None


def downgrade() -> None:
    return None
