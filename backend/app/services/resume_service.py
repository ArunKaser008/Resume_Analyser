from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.repositories import resume_repository as repository
from app.schemas.resume import ResumeCreate, ResumeUpdate


from app.models.career_profile import CareerProfile


def create_resume(db: Session, data: ResumeCreate) -> Resume:
    if data.career_profile_id is None:
        profile = CareerProfile(
            profile_type=data.profile_type,
            full_name=(data.full_name or data.title).strip(),
        )
        db.add(profile)
        db.flush()
        data = data.model_copy(update={"career_profile_id": profile.id})
    elif db.get(CareerProfile, data.career_profile_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return repository.create(db, data)


def get_resume(db: Session, resume_id: UUID) -> Resume:

    resume = repository.get_by_id(db, resume_id)

    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )

    return resume


def get_resumes(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 20,
):
    return repository.get_all(
        db,
        career_profile_id,
        skip,
        limit,
    )


def update_resume(
    db: Session,
    resume_id: UUID,
    data: ResumeUpdate,
) -> Resume:

    resume = get_resume(db, resume_id)

    return repository.update(db, resume, data)


def delete_resume(db: Session, resume_id: UUID) -> None:

    resume = get_resume(db, resume_id)

    repository.delete(db, resume)   