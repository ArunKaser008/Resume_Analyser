import asyncio
import logging
from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.database import get_db
from app.core.rate_limit import (
    enforce_bullet_optimizer_rate_limit,
    enforce_proof_of_work_rate_limit,
)
from app.schemas.dashboard import (
    CopilotChatRequest,
    CopilotChatResponse,
    DashboardResponse,
    InterviewPrepRequest,
    InterviewPrepResponse,
    TierSimulationRequest,
    TierSimulationResponse,
)
from app.services.ai_client import AIResponseError
from app.services.dashboard_service import DashboardService
from app.services.interview_prep_service import InterviewPrepService, ResumeCopilotService
from app.services.proof_of_work_service import (
    ProofOfWorkProviderError,
    ProofOfWorkRateLimitError,
    ProofOfWorkService,
)
from app.services.simulator_service import SimulatorService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Post-analysis dashboard"])


async def _with_retries(call: Callable, *args):
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            return await run_in_threadpool(call, *args)
        except AIResponseError as exc:
            last_error = exc
            if attempt < 2:
                await asyncio.sleep(0.2 * (2 ** attempt))
    if last_error is None:
        raise RuntimeError("AI retry loop exited without a result or error.")
    raise last_error


@router.get("/{analysis_id}", response_model=DashboardResponse)
async def get_dashboard(
    analysis_id: UUID,
    db: Session = Depends(get_db),
) -> DashboardResponse:
    try:
        return await run_in_threadpool(DashboardService.build, db, analysis_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unable to load dashboard.")
        raise HTTPException(status_code=500, detail="Unable to load the dashboard.") from exc


@router.post("/simulate-tier", response_model=TierSimulationResponse)
async def simulate_tier(
    request: TierSimulationRequest,
    db: Session = Depends(get_db),
    _: None = Depends(enforce_proof_of_work_rate_limit),
) -> TierSimulationResponse:
    proof_score = 0
    proof_verified = False
    try:
        if request.tier_type.value == "MAANG_PRODUCT":
            proof_request = await run_in_threadpool(
                SimulatorService.proof_request,
                db,
                request.resume_id,
            )
            if proof_request.github_url or proof_request.leetcode_url or proof_request.projects:
                try:
                    proof = await ProofOfWorkService.verify(proof_request)
                    proof_score = proof.score
                    proof_verified = proof.status.value == "Verified"
                except ProofOfWorkRateLimitError as exc:
                    logger.warning("Proof-of-work verification was rate-limited: %s", exc)
                except ProofOfWorkProviderError as exc:
                    logger.warning("Proof-of-work verification was unavailable: %s", exc)
        return await run_in_threadpool(
            SimulatorService.simulate,
            db,
            request.resume_id,
            request.tier_type,
            proof_score,
            proof_verified,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Company tier simulation failed.")
        raise HTTPException(status_code=500, detail="Unable to simulate this company tier.") from exc


@router.post("/interview-prep", response_model=InterviewPrepResponse)
async def interview_prep(
    request: InterviewPrepRequest,
    db: Session = Depends(get_db),
    _: None = Depends(enforce_bullet_optimizer_rate_limit),
) -> InterviewPrepResponse:
    try:
        return await _with_retries(
            InterviewPrepService.generate,
            db,
            request.resume_id,
            request.target_jd,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AIResponseError as exc:
        logger.exception("Interview preparation failed after retries.")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Interview preparation failed.")
        raise HTTPException(status_code=500, detail="Unable to generate interview preparation.") from exc


@router.post("/copilot-chat", response_model=CopilotChatResponse)
async def copilot_chat(
    request: CopilotChatRequest,
    db: Session = Depends(get_db),
    _: None = Depends(enforce_bullet_optimizer_rate_limit),
) -> CopilotChatResponse:
    try:
        return await _with_retries(
            ResumeCopilotService.answer,
            db,
            request.resume_id,
            request.message,
            request.context_section_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AIResponseError as exc:
        logger.exception("Resume copilot failed after retries.")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Resume copilot failed.")
        raise HTTPException(status_code=500, detail="Unable to respond to this resume request.") from exc
