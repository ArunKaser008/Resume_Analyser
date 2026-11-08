
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.career_profile import (
    CareerProfileCreate,
    CareerProfileUpdate,
    CareerProfileResponse,
)
from app.services import career_profile_service as service


router = APIRouter(
    prefix="/career-profiles",
    tags=["Career Profiles"],
)


@router.post(
    "",
    response_model=CareerProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_profile(data: CareerProfileCreate, db: Session = Depends(get_db)):
    return service.create_profile(db, data)


@router.get(
    "",
    response_model=list[CareerProfileResponse],
)
def get_profiles(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return service.get_profiles(db, skip, limit)


@router.get(
    "/{profile_id}",
    response_model=CareerProfileResponse,
)
def get_profile(profile_id: UUID, db: Session = Depends(get_db)):
    return service.get_profile(db, profile_id)


@router.put(
    "/{profile_id}",
    response_model=CareerProfileResponse,
)
def update_profile(
    profile_id: UUID,
    data: CareerProfileUpdate,
    db: Session = Depends(get_db),
):
    return service.update_profile(db, profile_id, data)


@router.delete(
    "/{profile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_profile(profile_id: UUID, db: Session = Depends(get_db)):
    service.delete_profile(db, profile_id)
