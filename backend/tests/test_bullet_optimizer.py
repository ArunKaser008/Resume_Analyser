import asyncio
import time

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1.bullet_optimizer import optimize_bullet
from app.main import app
from app.schemas.bullet_optimizer import (
    BulletOptimizeRequest,
    BulletOptimizeResponse,
    SeniorityLevel,
)
from app.services.bullet_optimizer_service import BulletOptimizerService
from app.services.ai_client import AIResponseError


def valid_ai_result() -> dict:
    return {
        "suggestions": [
            {
                "style": "metric",
                "optimized_bullet": (
                    "Accomplished [verified outcome] as measured by "
                    "[verified metric], by doing optimized API calls."
                ),
                "rationale": "Outcome and measurement phrases improve ATS parsing.",
            },
            {
                "style": "architecture",
                "optimized_bullet": (
                    "Accomplished [verified system outcome] as measured by "
                    "[verified metric], by doing optimized API calls."
                ),
                "rationale": "Architecture terms connect system outcomes to methods.",
            },
            {
                "style": "leadership_process",
                "optimized_bullet": (
                    "Accomplished [verified delivery outcome] as measured by "
                    "[verified metric], by doing optimized API calls."
                ),
                "rationale": "Process context helps ATS tools identify delivery impact.",
            },
        ]
    }


def request() -> BulletOptimizeRequest:
    return BulletOptimizeRequest(
        original_bullet="Optimized API calls.",
        target_role="Backend Engineer",
        seniority_level=SeniorityLevel.SENIOR,
    )


def test_optimizer_returns_three_valid_distinct_xyz_suggestions(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.bullet_optimizer_service.AIClient.generate_json",
        lambda *_args: valid_ai_result(),
    )

    result = BulletOptimizerService.optimize(request())
    validated = BulletOptimizeResponse.model_validate(result.model_dump())

    assert len(validated.suggestions) == 3
    assert {suggestion.style for suggestion in validated.suggestions} == {
        "metric",
        "architecture",
        "leadership_process",
    }
    assert all(
        "Accomplished " in suggestion.optimized_bullet
        and " as measured by " in suggestion.optimized_bullet
        and ", by doing " in suggestion.optimized_bullet
        and suggestion.rationale
        for suggestion in validated.suggestions
    )


def test_optimizer_rejects_non_xyz_or_duplicate_ai_output(monkeypatch) -> None:
    invalid = valid_ai_result()
    invalid["suggestions"][1]["optimized_bullet"] = "Improved platform performance."
    monkeypatch.setattr(
        "app.services.bullet_optimizer_service.AIClient.generate_json",
        lambda *_args: invalid,
    )

    with pytest.raises(AIResponseError, match="required XYZ format"):
        BulletOptimizerService.optimize(request())


@pytest.mark.anyio
async def test_optimizer_timeout_returns_xyz_placeholder_fallback(monkeypatch) -> None:
    def slow_optimize(_request: BulletOptimizeRequest) -> BulletOptimizeResponse:
        time.sleep(0.05)
        return BulletOptimizeResponse.model_validate(valid_ai_result())

    monkeypatch.setattr(
        "app.api.v1.bullet_optimizer.BulletOptimizerService.optimize",
        slow_optimize,
    )
    monkeypatch.setattr("app.api.v1.bullet_optimizer.LLM_TIMEOUT_SECONDS", 0.001)
    result = await optimize_bullet(request(), None)

    assert result.fallback_used is True
    assert len(result.suggestions) == 3
    assert all(
        "[verified metric]" in suggestion.optimized_bullet
        and ", by doing " in suggestion.optimized_bullet
        for suggestion in result.suggestions
    )
    await asyncio.sleep(0.06)


def test_optimizer_endpoint_validates_body_and_returns_suggestions(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.bullet_optimizer_service.AIClient.generate_json",
        lambda *_args: valid_ai_result(),
    )
    response = TestClient(app).post(
        "/api/v1/bullet/optimize",
        json={
            "original_bullet": "Optimized API calls.",
            "target_role": "Backend Engineer",
            "seniority_level": "SENIOR",
        },
    )

    assert response.status_code == 200
    assert len(response.json()["suggestions"]) == 3
    assert response.json()["fallback_used"] is False


def test_request_rejects_short_bullet_and_unknown_seniority() -> None:
    with pytest.raises(ValidationError):
        BulletOptimizeRequest(
            original_bullet="No",
            target_role="Engineer",
            seniority_level="INTERN",
        )
    response = TestClient(app).post(
        "/api/v1/bullet/optimize",
        json={
            "original_bullet": "Optimized API calls.",
            "target_role": "Backend Engineer",
            "seniority_level": "JUNIOR",
        },
    )
    assert response.status_code == 422
