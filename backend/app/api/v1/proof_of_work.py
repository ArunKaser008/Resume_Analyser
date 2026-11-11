import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.rate_limit import enforce_proof_of_work_rate_limit
from app.schemas.proof_of_work import ProofOfWorkRequest, ProofOfWorkResponse
from app.services.proof_of_work_service import (
    ProofOfWorkProviderError,
    ProofOfWorkRateLimitError,
    ProofOfWorkService,
)

router = APIRouter(prefix="/verify", tags=["Proof of work"])
logger = logging.getLogger(__name__)


@router.post(
    "/proof-of-work",
    response_model=ProofOfWorkResponse,
)
async def verify_proof_of_work(
    request: ProofOfWorkRequest,
    _: None = Depends(enforce_proof_of_work_rate_limit),
) -> ProofOfWorkResponse:
    try:
        return await ProofOfWorkService.verify(request)
    except ProofOfWorkRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ProofOfWorkProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected proof-of-work verification failure.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to verify proof-of-work claims.",
        ) from exc
