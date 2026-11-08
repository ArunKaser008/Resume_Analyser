
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.career_profile import CareerProfile
from app.models.education import Education
from app.repositories import education_repository as repository
from app.schemas.education import EducationCreate, EducationUpdate


def create_education(db: Session, data: EducationCreate) -> Education:
    profile = db.get(CareerProfile, data.career_profile_id)

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return repository.create(db, data)


def get_education(db: Session, education_id: UUID) -> Education:
    education = repository.get_by_id(db, education_id)

    if education is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Education record not found",
        )

    return education


def get_educations(
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


def update_education(
    db: Session,
    education_id: UUID,
    data: EducationUpdate,
) -> Education:
    education = get_education(db, education_id)

    updated = data.model_dump(exclude_unset=True)
    institution_name = updated.get("institution_name", education.institution_name)
    degree = updated.get("degree", education.degree)
    start_date = updated.get("start_date", education.start_date)
    end_date = updated.get("end_date", education.end_date)
    is_current = updated.get("is_current", education.is_current)

    if institution_name is None or degree is None:
        raise HTTPException(status_code=422, detail="Institution and degree cannot be null")

    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=422, detail="End date cannot be before start date")

    if is_current and end_date:
        raise HTTPException(status_code=422, detail="Current education cannot have an end date")

    return repository.update(db, education, data)


def delete_education(db: Session, education_id: UUID) -> None:
    education = get_education(db, education_id)
    repository.delete(db, education)
