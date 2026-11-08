
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.resume_optimization_review import (
    OptimizationDecisionRequest,
    OptimizationDecisionResponse,
    OptimizationSessionCreate,
    OptimizationSessionResponse,
)
from app.services.ai_client import (
    AIConfigurationError,
    AIResponseError,
)
from app.services.resume_optimization_review_service import (
    ResumeOptimizationReviewService,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Resume Optimization Review"])


def build_session_response(data: dict) -> dict:
    session = data["session"]

    return {
        "id": session.id,
        "resume_id": session.resume_id,
        "target_role": session.target_role,
        "job_description": session.job_description,
        "status": session.status,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "suggestions": data["suggestions"],
    }


@router.post(
    "/resumes/{resume_id}/optimization-sessions",
    response_model=OptimizationSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_optimization_session(
    resume_id: UUID,
    request: OptimizationSessionCreate,
    db: Session = Depends(get_db),
):
    try:
        result = ResumeOptimizationReviewService.create_session(
            db,
            resume_id,
            request,
        )
        return build_session_response(result)

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
        logger.error("AI configuration error during optimization.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured correctly.",
        ) from exc

    except AIResponseError as exc:
        logger.exception("AI processing failed during optimization.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service could not process the optimization request.",
        ) from exc

    except SQLAlchemyError as exc:
        logger.exception("Database error during optimization session creation.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database operation failed.",
        ) from exc

    except Exception as exc:
        logger.exception("Failed to create optimization session.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create optimization session.",
        ) from exc


@router.get(
    "/resumes/{resume_id}/optimization-sessions",
    response_model=list[OptimizationSessionResponse],
)
def get_optimization_sessions(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        results = ResumeOptimizationReviewService.get_sessions(
            db,
            resume_id,
        )

        return [
            build_session_response(item)
            for item in results
        ]

    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        logger.exception("Database error retrieving optimization sessions.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database operation failed.",
        ) from exc

    except Exception as exc:
        logger.exception("Failed to retrieve optimization sessions.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve optimization sessions.",
        ) from exc


@router.get(
    "/optimization-sessions/{session_id}",
    response_model=OptimizationSessionResponse,
)
def get_optimization_session(
    session_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        result = ResumeOptimizationReviewService.get_session(
            db,
            session_id,
        )

        return build_session_response(result)

    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        logger.exception("Database error retrieving optimization session.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database operation failed.",
        ) from exc

    except Exception as exc:
        logger.exception("Failed to retrieve optimization session.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve optimization session.",
        ) from exc


@router.patch(
    "/optimization-suggestions/{suggestion_id}/decision",
    response_model=OptimizationDecisionResponse,
)
def update_optimization_decision(
    suggestion_id: UUID,
    request: OptimizationDecisionRequest,
    db: Session = Depends(get_db),
):
    try:
        result = ResumeOptimizationReviewService.update_decision(
            db,
            suggestion_id,
            request.status,
        )

        return {
            "message": f"Suggestion {request.status} successfully.",
            "suggestion": result["suggestion"],
            "session_status": result["session_status"],
        }

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
        logger.exception("Database error updating optimization decision.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database operation failed.",
        ) from exc

    except Exception as exc:
        logger.exception("Failed to update optimization decision.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update optimization decision.",
        ) from exc
