from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.resume_section import (
    ResumeSectionsUpdate,
    ResumeSectionsResponse,
)
from app.services.resume_section_service import ResumeSectionService


router = APIRouter(
    prefix="/resumes",
    tags=["Resume Sections"],
)


@router.put(
    "/{resume_id}/sections",
    response_model=ResumeSectionsResponse,
)
def save_resume_sections(
    resume_id: UUID,
    request: ResumeSectionsUpdate,
    db: Session = Depends(get_db),
):
    try:
        return ResumeSectionService.save_sections(
            db=db,
            resume_id=resume_id,
            sections=request.sections,
        )

    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exec


@router.get(
    "/{resume_id}/sections",
    response_model=ResumeSectionsResponse,
)
def get_resume_sections(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        return ResumeSectionService.get_sections(
            db=db,
            resume_id=resume_id,
        )

    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))