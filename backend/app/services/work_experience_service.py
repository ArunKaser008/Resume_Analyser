
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.career_profile import CareerProfile
from app.models.work_experience import WorkExperience
from app.repositories import work_experience_repository as repository
from app.schemas.work_experience import (
    WorkExperienceCreate,
    WorkExperienceUpdate,
)


def create_experience(
    db: Session,
    data: WorkExperienceCreate,
) -> WorkExperience:
    profile = db.get(CareerProfile, data.career_profile_id)

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return repository.create(db, data)


def get_experience(db: Session, experience_id: UUID) -> WorkExperience:
    experience = repository.get_by_id(db, experience_id)

    if experience is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work experience not found",
        )

    return experience


def get_experiences(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 20,
):
    if career_profile_id and db.get(CareerProfile, career_profile_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return repository.get_all(db, career_profile_id, skip, limit)


def update_experience(
    db: Session,
    experience_id: UUID,
    data: WorkExperienceUpdate,
) -> WorkExperience:
    experience = get_experience(db, experience_id)
    updated = data.model_dump(exclude_unset=True)

    company_name = updated.get("company_name", experience.company_name)
    job_title = updated.get("job_title", experience.job_title)
    start_date = updated.get("start_date", experience.start_date)
    end_date = updated.get("end_date", experience.end_date)
    is_current = updated.get("is_current", experience.is_current)

    if company_name is None or job_title is None or start_date is None:
        raise HTTPException(
            status_code=422,
            detail="Company, job title and start date cannot be null",
        )

    if end_date and end_date < start_date:
        raise HTTPException(
            status_code=422,
            detail="End date cannot be before start date",
        )

    if is_current and end_date:
        raise HTTPException(
            status_code=422,
            detail="Current employment cannot have an end date",
        )

    return repository.update(db, experience, data)


def delete_experience(db: Session, experience_id: UUID) -> None:
    experience = get_experience(db, experience_id)
    repository.delete(db, experience)
