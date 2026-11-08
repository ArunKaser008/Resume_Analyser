import logging

from fastapi import APIRouter, HTTPException, status

from app.schemas.job_description import (
    JobDescriptionAnalysisRequest,
    JobDescriptionAnalysisResponse,
)
from app.services.ai_client import (
    AIConfigurationError,
    AIResponseError,
)
from app.services.job_description_service import JobDescriptionService


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/job-descriptions",
    tags=["Job Description Analysis"],
)


@router.post(
    "/analyze",
    response_model=JobDescriptionAnalysisResponse,
    status_code=status.HTTP_200_OK,
)
def analyze_job_description(
    request: JobDescriptionAnalysisRequest,
):
    try:
        return JobDescriptionService.analyze(
            job_description=request.job_description
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except AIConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    except AIResponseError as exc:
        logger.exception("JD analysis AI request failed.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        logger.exception("Unexpected JD analysis error.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to analyze job description.",
        ) from exc