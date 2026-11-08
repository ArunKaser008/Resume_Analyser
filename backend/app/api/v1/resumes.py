from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.resume import ResumeCreate, ResumeUpdate, ResumeResponse
from app.services import resume_service as service


router = APIRouter(prefix="/resumes", tags=["Resumes"])


@router.post(
    "",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_resume(
    data: ResumeCreate,
    db: Session = Depends(get_db),
):
    return service.create_resume(db, data)


@router.get("", response_model=list[ResumeResponse])
def get_resumes(
    career_profile_id: UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return service.get_resumes(db, career_profile_id, skip, limit)


@router.get("/{resume_id}", response_model=ResumeResponse)
def get_resume(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_resume(db, resume_id)


@router.put("/{resume_id}", response_model=ResumeResponse)
def update_resume(
    resume_id: UUID,
    data: ResumeUpdate,
    db: Session = Depends(get_db),
):
    return service.update_resume(db, resume_id, data)


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_resume(db, resume_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)