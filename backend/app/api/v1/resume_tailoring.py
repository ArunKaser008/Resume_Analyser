
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.resume_tailoring import ResumeTailoringRequest
from app.services.ai_client import (
    AIConfigurationError,
    AIResponseError,
)
from app.services.resume_tailoring_service import (
    ResumeTailoringService,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/resumes",
    tags=["Resume Tailoring"],
)


@router.post(
    "/{resume_id}/tailor",
    status_code=status.HTTP_200_OK,
)
def tailor_resume(
    resume_id: UUID,
    request: ResumeTailoringRequest,
    db: Session = Depends(get_db),
):
    try:
        return ResumeTailoringService.tailor(
            db=db,
            resume_id=resume_id,
            job_description=request.job_description,
        )

    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    except AIConfigurationError as exc:
        logger.error("AI configuration error during resume tailoring.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    except AIResponseError as exc:
        logger.exception("AI response error during resume tailoring.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        logger.exception("Database error during resume tailoring.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database operation failed during resume tailoring.",
        ) from exc

    except Exception as exc:
        logger.exception("Unexpected error during resume tailoring.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Resume tailoring failed.",
        ) from exc
