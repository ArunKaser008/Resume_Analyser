
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import career_profile_repository as repository
from app.schemas.career_profile import (
    CareerProfileCreate,
    CareerProfileUpdate,
)


def create_profile(db: Session, data: CareerProfileCreate):
    return repository.create(db, data)


def get_profile(db: Session, profile_id: UUID):
    profile = repository.get_by_id(db, profile_id)

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return profile


def get_profiles(db: Session, skip: int = 0, limit: int = 20):
    return repository.get_all(db, skip, limit)


def update_profile(
    db: Session,
    profile_id: UUID,
    data: CareerProfileUpdate,
):
    profile = get_profile(db, profile_id)
    return repository.update(db, profile, data)


def delete_profile(db: Session, profile_id: UUID):
    profile = get_profile(db, profile_id)
    repository.delete(db, profile)
