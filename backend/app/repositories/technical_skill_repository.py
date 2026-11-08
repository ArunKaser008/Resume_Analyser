
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.technical_skill import TechnicalSkill
from app.schemas.technical_skill import (
    TechnicalSkillCreate,
    TechnicalSkillUpdate,
)


def create(db: Session, data: TechnicalSkillCreate) -> TechnicalSkill:
    skill = TechnicalSkill(**data.model_dump())
    db.add(skill)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(skill)
    return skill


def get_by_id(db: Session, skill_id: UUID) -> TechnicalSkill | None:
    return db.get(TechnicalSkill, skill_id)


def get_all(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[TechnicalSkill]:

    statement = select(TechnicalSkill).order_by(
        TechnicalSkill.skill_name.asc()
    )

    if career_profile_id:
        statement = statement.where(
            TechnicalSkill.career_profile_id == career_profile_id
        )

    statement = statement.offset(skip).limit(limit)
    return list(db.scalars(statement).all())


def update(
    db: Session,
    skill: TechnicalSkill,
    data: TechnicalSkillUpdate,
) -> TechnicalSkill:

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(skill, field, value)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(skill)
    return skill


def delete(db: Session, skill: TechnicalSkill) -> None:
    db.delete(skill)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
