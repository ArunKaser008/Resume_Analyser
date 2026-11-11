import asyncio
import logging
import time

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)

RESUME_PARSE_LIMIT = 10
PROOF_OF_WORK_LIMIT = 10
BULLET_OPTIMIZER_LIMIT = 20
RATE_LIMIT_WINDOW_SECONDS = 60
_memory_windows: dict[str, tuple[int, int]] = {}
_memory_lock = asyncio.Lock()
_fallback_warning_logged = False


async def _enforce_rate_limit(
    request: Request,
    *,
    scope: str,
    limit: int,
    detail: str,
) -> None:
    client_host = request.client.host if request.client else "unknown"
    window = int(time.time()) // RATE_LIMIT_WINDOW_SECONDS

    if settings.redis_url:
        key = f"rate-limit:{scope}:{client_host}:{window}"
        try:
            async with Redis.from_url(settings.redis_url, decode_responses=True) as client:
                count = await client.eval(
                    "local count = redis.call('INCR', KEYS[1]); "
                    "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; "
                    "return count",
                    1,
                    key,
                    RATE_LIMIT_WINDOW_SECONDS,
                )
        except RedisError as exc:
            logger.exception("Redis %s rate limiter is unavailable.", scope)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The requested service is temporarily unavailable.",
            ) from exc
    else:
        if settings.app_env != "development":
            logger.error(
                "REDIS_URL must be configured outside development for %s rate limiting.",
                scope,
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The requested service is temporarily unavailable.",
            )

        global _fallback_warning_logged
        if not _fallback_warning_logged:
            logger.warning(
                "REDIS_URL is not configured; %s rate limiting is "
                "limited to this backend process.",
                scope,
            )
            _fallback_warning_logged = True
        memory_key = f"{scope}:{client_host}"
        async with _memory_lock:
            current_window, count = _memory_windows.get(memory_key, (window, 0))
            if current_window != window:
                current_window, count = window, 0
            count += 1
            _memory_windows[memory_key] = (current_window, count)
            if len(_memory_windows) > 10_000:
                expired_hosts = [
                    host
                    for host, (stored_window, _) in _memory_windows.items()
                    if stored_window != window
                ]
                for host in expired_hosts:
                    del _memory_windows[host]

    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
        )


async def enforce_resume_parse_rate_limit(request: Request) -> None:
    await _enforce_rate_limit(
        request,
        scope="resume-parse",
        limit=RESUME_PARSE_LIMIT,
        detail="Resume parsing is limited to 10 requests per minute.",
    )


async def enforce_proof_of_work_rate_limit(request: Request) -> None:
    await _enforce_rate_limit(
        request,
        scope="proof-of-work",
        limit=PROOF_OF_WORK_LIMIT,
        detail="Proof-of-work verification is limited to 10 requests per minute.",
    )


async def enforce_bullet_optimizer_rate_limit(request: Request) -> None:
    await _enforce_rate_limit(
        request,
        scope="bullet-optimizer",
        limit=BULLET_OPTIMIZER_LIMIT,
        detail="Bullet optimization is limited to 20 requests per minute.",
    )

