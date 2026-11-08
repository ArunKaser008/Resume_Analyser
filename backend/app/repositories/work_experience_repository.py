
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.work_experience import WorkExperience
from app.schemas.work_experience import (
    WorkExperienceCreate,
    WorkExperienceUpdate,
)


def create(db: Session, data: WorkExperienceCreate) -> WorkExperience:
    experience = WorkExperience(**data.model_dump())
    db.add(experience)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(experience)
    return experience


def get_by_id(db: Session, experience_id: UUID) -> WorkExperience | None:
    return db.get(WorkExperience, experience_id)


def get_all(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[WorkExperience]:
    statement = select(WorkExperience).order_by(
        WorkExperience.start_date.desc()
    )

    if career_profile_id:
        statement = statement.where(
            WorkExperience.career_profile_id == career_profile_id
        )

    statement = statement.offset(skip).limit(limit)
    return list(db.scalars(statement).all())


def update(
    db: Session,
    experience: WorkExperience,
    data: WorkExperienceUpdate,
) -> WorkExperience:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(experience, field, value)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(experience)
    return experience


def delete(db: Session, experience: WorkExperience) -> None:
    db.delete(experience)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
