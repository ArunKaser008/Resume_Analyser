import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool

from app.core.rate_limit import enforce_bullet_optimizer_rate_limit
from app.schemas.bullet_optimizer import (
    BulletOptimizeRequest,
    BulletOptimizeResponse,
)
from app.services.ai_client import AIConfigurationError, AIResponseError
from app.services.bullet_optimizer_service import BulletOptimizerService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bullet", tags=["Bullet optimization"])
LLM_TIMEOUT_SECONDS = 15


@router.post(
    "/optimize",
    response_model=BulletOptimizeResponse,
)
async def optimize_bullet(
    request: BulletOptimizeRequest,
    _: None = Depends(enforce_bullet_optimizer_rate_limit),
) -> BulletOptimizeResponse:
    try:
        return await asyncio.wait_for(
            run_in_threadpool(BulletOptimizerService.optimize, request),
            timeout=LLM_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        logger.warning("Bullet optimization timed out; returning XYZ templates.")
        try:
            return BulletOptimizerService.timeout_fallback(request)
        except Exception as exc:
            logger.exception("Unable to create bullet optimization timeout fallback.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to create bullet optimization suggestions.",
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
        logger.exception("Unexpected bullet optimization failure.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to optimize this resume bullet.",
        ) from exc
