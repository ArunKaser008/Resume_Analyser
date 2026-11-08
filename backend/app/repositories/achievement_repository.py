
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.achievement import Achievement
from app.schemas.achievement import AchievementCreate, AchievementUpdate


def create(db: Session, data: AchievementCreate) -> Achievement:
    achievement = Achievement(**data.model_dump(mode="json"))
    db.add(achievement)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(achievement)
    return achievement


def get_by_id(db: Session, achievement_id: UUID) -> Achievement | None:
    return db.get(Achievement, achievement_id)


def get_all(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Achievement]:
    statement = select(Achievement).order_by(
        Achievement.achievement_date.desc().nullslast()
    )

    if career_profile_id:
        statement = statement.where(
            Achievement.career_profile_id == career_profile_id
        )

    statement = statement.offset(skip).limit(limit)
    return list(db.scalars(statement).all())


def update(
    db: Session,
    achievement: Achievement,
    data: AchievementUpdate,
) -> Achievement:
    values = data.model_dump(exclude_unset=True, mode="json")

    for field, value in values.items():
        setattr(achievement, field, value)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(achievement)
    return achievement


def delete(db: Session, achievement: Achievement) -> None:
    db.delete(achievement)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
