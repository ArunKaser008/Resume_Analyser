import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.resume_analysis import (
    ResumeAnalysisRequest,
    ResumeAnalysisResponse,
)
from app.services.resume_analysis_service import ResumeAnalysisService


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/resumes",
    tags=["Resume Analysis"],
)


@router.post(
    "/{resume_id}/analyze",
    response_model=ResumeAnalysisResponse,
)
def analyze_resume(
    resume_id: UUID,
    request: ResumeAnalysisRequest,
    include_drafts: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    try:
        return ResumeAnalysisService.analyze(
            db=db,
            resume_id=resume_id,
            job_description=request.job_description,
            include_drafts=include_drafts,
        )

    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except Exception:
        logger.exception("Resume analysis failed")
        raise HTTPException(
            status_code=500,
            detail="Unable to analyze resume",
        )