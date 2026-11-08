
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.career_profile import CareerProfile
from app.models.technical_skill import TechnicalSkill
from app.repositories import technical_skill_repository as repository
from app.schemas.technical_skill import (
    TechnicalSkillCreate,
    TechnicalSkillUpdate,
)


def create_skill(db: Session, data: TechnicalSkillCreate) -> TechnicalSkill:
    profile = db.get(CareerProfile, data.career_profile_id)

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return repository.create(db, data)


def get_skill(db: Session, skill_id: UUID) -> TechnicalSkill:
    skill = repository.get_by_id(db, skill_id)

    if skill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technical skill not found",
        )

    return skill


def get_skills(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 50,
):
    if career_profile_id and db.get(CareerProfile, career_profile_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return repository.get_all(db, career_profile_id, skip, limit)


def update_skill(
    db: Session,
    skill_id: UUID,
    data: TechnicalSkillUpdate,
) -> TechnicalSkill:
    skill = get_skill(db, skill_id)
    updated = data.model_dump(exclude_unset=True)

    if updated.get("skill_name", skill.skill_name) is None:
        raise HTTPException(
            status_code=422,
            detail="Skill name cannot be null",
        )

    return repository.update(db, skill, data)


def delete_skill(db: Session, skill_id: UUID) -> None:
    skill = get_skill(db, skill_id)
    repository.delete(db, skill)
