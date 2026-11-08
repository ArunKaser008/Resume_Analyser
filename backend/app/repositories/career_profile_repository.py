
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.career_profile import CareerProfile
from app.schemas.career_profile import (
    CareerProfileCreate,
    CareerProfileUpdate,
)


def create(db: Session, data: CareerProfileCreate) -> CareerProfile:
    profile = CareerProfile(**data.model_dump(mode="json"))

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


def get_by_id(db: Session, profile_id: UUID) -> CareerProfile | None:
    return db.get(CareerProfile, profile_id)


def get_all(db: Session, skip: int = 0, limit: int = 20):
    statement = (
        select(CareerProfile)
        .order_by(CareerProfile.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(statement).all())


def update(
    db: Session,
    profile: CareerProfile,
    data: CareerProfileUpdate,
) -> CareerProfile:
    for field, value in data.model_dump(exclude_unset=True, mode="json").items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    return profile


def delete(db: Session, profile: CareerProfile) -> None:
    db.delete(profile)
    db.commit()
