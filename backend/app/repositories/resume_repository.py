from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.schemas.resume import ResumeCreate, ResumeUpdate


def create(db: Session, data: ResumeCreate) -> Resume:
    resume = Resume(**data.model_dump(include={
        "career_profile_id",
        "title",
        "target_role",
        "template_name",
        "is_primary",
    }))
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


def get_by_id(db: Session, resume_id: UUID) -> Resume | None:
    return db.get(Resume, resume_id)


def get_all(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Resume]:

    statement = select(Resume).order_by(Resume.created_at.desc())

    if career_profile_id:
        statement = statement.where(
            Resume.career_profile_id == career_profile_id
        )

    statement = statement.offset(skip).limit(limit)

    return list(db.scalars(statement).all())


def update(
    db: Session,
    resume: Resume,
    data: ResumeUpdate,
) -> Resume:

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(resume, field, value)

    db.commit()
    db.refresh(resume)
    return resume


def delete(db: Session, resume: Resume) -> None:
    db.delete(resume)
    db.commit()