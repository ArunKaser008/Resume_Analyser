
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.certification import (
    CertificationCreate,
    CertificationUpdate,
    CertificationResponse,
)
from app.services import certification_service as service


router = APIRouter(prefix="/certifications", tags=["Certifications"])


@router.post(
    "",
    response_model=CertificationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_certification(
    data: CertificationCreate,
    db: Session = Depends(get_db),
):
    return service.create_certification(db, data)


@router.get("", response_model=list[CertificationResponse])
def get_certifications(
    career_profile_id: UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return service.get_certifications(db, career_profile_id, skip, limit)


@router.get("/{certification_id}", response_model=CertificationResponse)
def get_certification(
    certification_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_certification(db, certification_id)


@router.put("/{certification_id}", response_model=CertificationResponse)
def update_certification(
    certification_id: UUID,
    data: CertificationUpdate,
    db: Session = Depends(get_db),
):
    return service.update_certification(db, certification_id, data)


@router.delete(
    "/{certification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_certification(
    certification_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_certification(db, certification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
