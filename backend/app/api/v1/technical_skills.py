
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.technical_skill import (
    TechnicalSkillCreate,
    TechnicalSkillUpdate,
    TechnicalSkillResponse,
)
from app.services import technical_skill_service as service


router = APIRouter(
    prefix="/technical-skills",
    tags=["Technical Skills"],
)


@router.post(
    "",
    response_model=TechnicalSkillResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_skill(
    data: TechnicalSkillCreate,
    db: Session = Depends(get_db),
):
    return service.create_skill(db, data)


@router.get("", response_model=list[TechnicalSkillResponse])
def get_skills(
    career_profile_id: UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return service.get_skills(db, career_profile_id, skip, limit)


@router.get("/{skill_id}", response_model=TechnicalSkillResponse)
def get_skill(
    skill_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_skill(db, skill_id)


@router.put("/{skill_id}", response_model=TechnicalSkillResponse)
def update_skill(
    skill_id: UUID,
    data: TechnicalSkillUpdate,
    db: Session = Depends(get_db),
):
    return service.update_skill(db, skill_id, data)


@router.delete(
    "/{skill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_skill(
    skill_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_skill(db, skill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
