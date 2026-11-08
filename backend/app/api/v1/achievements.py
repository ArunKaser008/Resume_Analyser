
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.achievement import (
    AchievementCreate,
    AchievementUpdate,
    AchievementResponse,
)
from app.services import achievement_service as service



router = APIRouter(prefix="/achievements", tags=["Achievements"])


@router.post(
    "",
    response_model=AchievementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_achievement(
    data: AchievementCreate,
    db: Session = Depends(get_db),
):
    return service.create_achievement(db, data)


@router.get("", response_model=list[AchievementResponse])
def get_achievements(
    career_profile_id: UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return service.get_achievements(db, career_profile_id, skip, limit)


@router.get("/{achievement_id}", response_model=AchievementResponse)
def get_achievement(
    achievement_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_achievement(db, achievement_id)


@router.put("/{achievement_id}", response_model=AchievementResponse)
def update_achievement(
    achievement_id: UUID,
    data: AchievementUpdate,
    db: Session = Depends(get_db),
):
    return service.update_achievement(db, achievement_id, data)


@router.delete(
    "/{achievement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_achievement(
    achievement_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_achievement(db, achievement_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
