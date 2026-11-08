
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.education import (
    EducationCreate,
    EducationUpdate,
    EducationResponse,
)
from app.services import education_service as service


router = APIRouter(prefix="/educations", tags=["Education"])


@router.post(
    "",
    response_model=EducationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_education(
    data: EducationCreate,
    db: Session = Depends(get_db),
):
    return service.create_education(db, data)


@router.get("", response_model=list[EducationResponse])
def get_educations(
    career_profile_id: UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return service.get_educations(db, career_profile_id, skip, limit)


@router.get("/{education_id}", response_model=EducationResponse)
def get_education(
    education_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_education(db, education_id)


@router.put("/{education_id}", response_model=EducationResponse)
def update_education(
    education_id: UUID,
    data: EducationUpdate,
    db: Session = Depends(get_db),
):
    return service.update_education(db, education_id, data)


@router.delete("/{education_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_education(
    education_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_education(db, education_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
