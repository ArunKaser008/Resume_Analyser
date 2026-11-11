"""enforce safe resume typography defaults

Revision ID: c2a809f0d44b
Revises: f37c4a281b9d
Create Date: 2026-11-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2a809f0d44b"
down_revision: Union[str, Sequence[str], None] = "f37c4a281b9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

APPROVED_FONTS = {
    "Arial",
    "Garamond",
    "Georgia",
    "Helvetica",
    "Inter",
    "Merriweather",
    "Roboto",
}


def upgrade() -> None:
    bind = op.get_bind()
    resumes = sa.table(
        "resumes",
        sa.column("id", sa.Uuid()),
        sa.column("design_settings", sa.JSON()),
    )
    rows = bind.execute(sa.select(resumes.c.id, resumes.c.design_settings)).mappings()
    for row in rows:
        settings = dict(row["design_settings"] or {})
        if settings.get("font_family") not in APPROVED_FONTS:
            settings["font_family"] = "Arial"
        settings["font_size"] = 10
        bind.execute(
            sa.update(resumes)
            .where(resumes.c.id == row["id"])
            .values(design_settings=settings)
        )


def downgrade() -> None:
    bind = op.get_bind()
    resumes = sa.table(
        "resumes",
        sa.column("id", sa.Uuid()),
        sa.column("design_settings", sa.JSON()),
    )
    rows = bind.execute(sa.select(resumes.c.id, resumes.c.design_settings)).mappings()
    for row in rows:
        settings = dict(row["design_settings"] or {})
        settings["font_size"] = 12
        if settings.get("font_family") in {"Garamond", "Helvetica", "Merriweather", "Roboto"}:
            settings["font_family"] = "Arial"
        bind.execute(
            sa.update(resumes)
            .where(resumes.c.id == row["id"])
            .values(design_settings=settings)
        )
