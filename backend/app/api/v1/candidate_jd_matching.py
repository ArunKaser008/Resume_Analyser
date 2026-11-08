import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.job_description import JobDescriptionAnalysisRequest
from app.schemas.candidate_jd_match import CandidateJDMatchResponse
from app.services.candidate_jd_matching_service import (
    CandidateJDMatchingService,
)
from app.services.ai_client import (
    AIConfigurationError,
    AIResponseError,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/resumes",
    tags=["Candidate Job Description Matching"],
)


@router.post(
    "/{resume_id}/match-job-description",
    response_model=CandidateJDMatchResponse,
)
def match_resume_with_job_description(
    resume_id: UUID,
    request: JobDescriptionAnalysisRequest,
    db: Session = Depends(get_db),
):
    try:
        return CandidateJDMatchingService.match(
            db=db,
            resume_id=resume_id,
            job_description=request.job_description,
        )

    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except AIConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    except AIResponseError as exc:
        logger.exception("AI job description matching failed.")
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        logger.exception("Unexpected candidate-JD matching error.")
        raise HTTPException(
            status_code=500,
            detail="Unable to match resume with job description.",
        ) from exc