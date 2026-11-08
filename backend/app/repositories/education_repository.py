
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.education import Education
from app.schemas.education import EducationCreate, EducationUpdate


def create(db: Session, data: EducationCreate) -> Education:
    education = Education(**data.model_dump())
    db.add(education)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(education)
    return education


def get_by_id(db: Session, education_id: UUID) -> Education | None:
    return db.get(Education, education_id)


def get_all(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Education]:
    statement = select(Education).order_by(Education.start_date.desc().nullslast())

    if career_profile_id:
        statement = statement.where(
            Education.career_profile_id == career_profile_id
        )

    statement = statement.offset(skip).limit(limit)
    return list(db.scalars(statement).all())


def update(
    db: Session,
    education: Education,
    data: EducationUpdate,
) -> Education:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(education, field, value)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(education)
    return education


def delete(db: Session, education: Education) -> None:
    db.delete(education)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
