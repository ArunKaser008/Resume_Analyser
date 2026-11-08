
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.work_experience import (
    WorkExperienceCreate,
    WorkExperienceUpdate,
    WorkExperienceResponse,
)
from app.services import work_experience_service as service


router = APIRouter(
    prefix="/work-experiences",
    tags=["Work Experience"],
)


@router.post(
    "",
    response_model=WorkExperienceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_experience(
    data: WorkExperienceCreate,
    db: Session = Depends(get_db),
):
    return service.create_experience(db, data)


@router.get("", response_model=list[WorkExperienceResponse])
def get_experiences(
    career_profile_id: UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return service.get_experiences(db, career_profile_id, skip, limit)


@router.get("/{experience_id}", response_model=WorkExperienceResponse)
def get_experience(
    experience_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_experience(db, experience_id)


@router.put("/{experience_id}", response_model=WorkExperienceResponse)
def update_experience(
    experience_id: UUID,
    data: WorkExperienceUpdate,
    db: Session = Depends(get_db),
):
    return service.update_experience(db, experience_id, data)


@router.delete(
    "/{experience_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_experience(
    experience_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_experience(db, experience_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
