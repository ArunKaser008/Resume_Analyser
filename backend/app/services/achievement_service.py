
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.career_profile import CareerProfile
from app.models.achievement import Achievement
from app.repositories import achievement_repository as repository
from app.schemas.achievement import AchievementCreate, AchievementUpdate


def create_achievement(
    db: Session,
    data: AchievementCreate,
) -> Achievement:
    if db.get(CareerProfile, data.career_profile_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return repository.create(db, data)


def get_achievement(
    db: Session,
    achievement_id: UUID,
) -> Achievement:
    achievement = repository.get_by_id(db, achievement_id)

    if achievement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Achievement not found",
        )

    return achievement


def get_achievements(
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


def update_achievement(
    db: Session,
    achievement_id: UUID,
    data: AchievementUpdate,
) -> Achievement:
    achievement = get_achievement(db, achievement_id)

    if "title" in data.model_fields_set and data.title is None:
        raise HTTPException(
            status_code=422,
            detail="Achievement title cannot be null",
        )

    return repository.update(db, achievement, data)


def delete_achievement(db: Session, achievement_id: UUID) -> None:
    achievement = get_achievement(db, achievement_id)
    repository.delete(db, achievement)
