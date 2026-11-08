
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.career_profile import CareerProfile
from app.models.certification import Certification
from app.repositories import certification_repository as repository
from app.schemas.certification import CertificationCreate, CertificationUpdate


def create_certification(
    db: Session,
    data: CertificationCreate,
) -> Certification:
    if db.get(CareerProfile, data.career_profile_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return repository.create(db, data)


def get_certification(
    db: Session,
    certification_id: UUID,
) -> Certification:
    certification = repository.get_by_id(db, certification_id)

    if certification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certification not found",
        )

    return certification


def get_certifications(
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


def update_certification(
    db: Session,
    certification_id: UUID,
    data: CertificationUpdate,
) -> Certification:
    certification = get_certification(db, certification_id)
    values = data.model_dump(exclude_unset=True)

    name = values.get("certification_name", certification.certification_name)
    organization = values.get(
        "issuing_organization", certification.issuing_organization
    )
    issue_date = values.get("issue_date", certification.issue_date)
    expiry_date = values.get("expiry_date", certification.expiry_date)
    does_not_expire = values.get(
        "does_not_expire", certification.does_not_expire
    )

    if name is None or organization is None:
        raise HTTPException(
            status_code=422,
            detail="Certification name and issuing organization cannot be null",
        )

    if issue_date and expiry_date and expiry_date < issue_date:
        raise HTTPException(
            status_code=422,
            detail="Expiry date cannot be before issue date",
        )

    if does_not_expire and expiry_date:
        raise HTTPException(
            status_code=422,
            detail="Non-expiring certification cannot have an expiry date",
        )

    return repository.update(db, certification, data)


def delete_certification(db: Session, certification_id: UUID) -> None:
    certification = get_certification(db, certification_id)
    repository.delete(db, certification)
