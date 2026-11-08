
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.resume_content_override import (
    ApplySuggestionRequest,
    ResumeContentOverrideResponse,
)
from app.services.resume_content_override_service import (
    ResumeContentOverrideService,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Resume Content Overrides"])


@router.post(
    "/optimization-suggestions/{suggestion_id}/apply",
    response_model=ResumeContentOverrideResponse,
    status_code=status.HTTP_201_CREATED,
)
def apply_optimization_suggestion(
    suggestion_id: UUID,
    request: ApplySuggestionRequest,
    db: Session = Depends(get_db),
):
    try:
        return ResumeContentOverrideService.apply_suggestion(
            db=db,
            suggestion_id=suggestion_id,
            target_field=request.target_field,
            target_item_id=request.target_item_id,
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

    except SQLAlchemyError as exc:
        logger.exception("Database error applying optimization suggestion.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database operation failed while applying the suggestion.",
        ) from exc

    except Exception as exc:
        logger.exception("Failed to apply optimization suggestion.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to apply optimization suggestion.",
        ) from exc


@router.get(
    "/resumes/{resume_id}/content-overrides",
    response_model=list[ResumeContentOverrideResponse],
)
def get_resume_content_overrides(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        return ResumeContentOverrideService.get_overrides(
            db,
            resume_id,
        )

    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        logger.exception("Database error retrieving resume content overrides.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database operation failed.",
        ) from exc

    except Exception as exc:
        logger.exception("Failed to retrieve resume content overrides.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve resume content overrides.",
        ) from exc


@router.delete(
    "/resumes/{resume_id}/content-overrides/{override_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_resume_content_override(
    resume_id: UUID,
    override_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        ResumeContentOverrideService.delete_override(
            db,
            resume_id,
            override_id,
        )
        return None

    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        logger.exception("Database error deleting resume content override.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database operation failed.",
        ) from exc

    except Exception as exc:
        logger.exception("Failed to delete resume content override.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete resume content override.",
        ) from exc
