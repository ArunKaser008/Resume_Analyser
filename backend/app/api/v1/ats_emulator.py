import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.database import get_db
from app.core.rate_limit import enforce_proof_of_work_rate_limit
from app.schemas.ats_emulator import (
    ATSAnalyzeJDRequest,
    ATSAnalyzeJDResponse,
)
from app.services.ai_client import AIConfigurationError, AIResponseError
from app.services.ats_emulator_service import ATSEmulatorService

router = APIRouter(prefix="/resume", tags=["ATS emulator"])
logger = logging.getLogger(__name__)


@router.post(
    "/analyze-jd",
    response_model=ATSAnalyzeJDResponse,
)
async def analyze_resume_against_jd(
    data: ATSAnalyzeJDRequest,
    db: Session = Depends(get_db),
    _: None = Depends(enforce_proof_of_work_rate_limit),
) -> ATSAnalyzeJDResponse:
    try:
        return await run_in_threadpool(
            ATSEmulatorService.analyze,
            db,
            resume_id=data.resume_id,
            job_description=data.job_description,
            target_ats=data.target_ats,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except AIConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except AIResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("ATS emulator analysis failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to analyze this resume against the job description.",
        ) from exc
