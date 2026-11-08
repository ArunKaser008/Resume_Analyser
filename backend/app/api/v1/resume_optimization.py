import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.resume_optimization import (
    ResumeOptimizationRequest,
    ResumeOptimizationResponse,
)
from app.services.resume_optimization_service import (
    ResumeOptimizationService,
)
from app.services.ai_client import (
    AIConfigurationError,
    AIResponseError,
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/resumes",
    tags=["AI Resume Optimization"],
)


@router.post(
    "/{resume_id}/optimize",
    response_model=ResumeOptimizationResponse,
)
def optimize_resume(
    resume_id: UUID,
    request: ResumeOptimizationRequest,
    db: Session = Depends(get_db),
):
    try:
        return ResumeOptimizationService.optimize(
            db=db,
            resume_id=resume_id,
            job_description=request.job_description,
        )

    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except AIConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )

    except AIResponseError as exc:
        logger.exception("AI resume optimization failed")
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    except Exception:
        logger.exception("Unexpected resume optimization error")
        raise HTTPException(
            status_code=500,
            detail="Unable to optimize resume",
        )