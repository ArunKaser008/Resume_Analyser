import asyncio
from datetime import datetime, timezone

import httpx
import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.rate_limit import (
    PROOF_OF_WORK_LIMIT,
    _memory_windows,
    enforce_proof_of_work_rate_limit,
)
from app.main import app
from app.schemas.proof_of_work import (
    GitHubStats,
    LeetCodeStats,
    ProofOfWorkRequest,
    ProofOfWorkResponse,
    ProofStatus,
    VerifiedProject,
)
from app.services.proof_of_work_service import (
    ProofOfWorkRateLimitError,
    ProofOfWorkService,
    calculate_proof_score,
    extract_profile_usernames,
)


def _mock_provider_response(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/users/ada":
        return httpx.Response(200, json={"login": "ada"})
    if request.url.path == "/repos/ada/portfolio":
        return httpx.Response(
            200,
            json={
                "owner": {"login": "ada"},
                "fork": False,
                "size": 20,
                "stargazers_count": 8,
                "default_branch": "main",
            },
        )
    if request.url.path == "/repos/ada/portfolio/languages":
        return httpx.Response(200, json={"Python": 2000, "TypeScript": 1000})
    if request.url.path == "/repos/ada/portfolio/commits":
        return httpx.Response(
            200,
            json=[{
                "commit": {
                    "author": {
                        "date": datetime.now(timezone.utc).isoformat(),
                    }
                }
            }],
        )
    if request.url.host == "leetcode.com":
        return httpx.Response(
            200,
            json={
                "data": {
                    "matchedUser": {
                        "submitStatsGlobal": {
                            "acSubmissionNum": [
                                {"difficulty": "Easy", "count": 20},
                                {"difficulty": "Medium", "count": 12},
                                {"difficulty": "Hard", "count": 3},
                            ]
                        }
                    },
                    "userContestRanking": {
                        "attendedContestsCount": 4,
                        "rating": 1540.5,
                        "globalRanking": 12000,
                    },
                }
            },
        )
    return httpx.Response(404, json={"message": "Not found"})


@pytest.mark.anyio
async def test_verifies_github_project_and_leetcode_stats() -> None:
    request = ProofOfWorkRequest.model_validate({
        "github_url": "https://github.com/ada",
        "leetcode_url": "https://leetcode.com/u/ada/",
        "projects": [{
            "title": "Portfolio",
            "bullet_points": ["Built the app: https://github.com/ada/portfolio"],
        }],
    })
    transport = httpx.MockTransport(_mock_provider_response)

    result = await ProofOfWorkService.verify(request, transport=transport)

    assert result.github is not None
    assert result.github.valid is True
    assert result.github.recent_commits == 1
    assert result.github.stars == 8
    assert result.github.top_languages == {"Python": 2000, "TypeScript": 1000}
    assert len(result.github.monthly_activity) == 12
    assert result.projects[0].status == ProofStatus.VERIFIED
    assert result.projects[0].owner_matches_profile is True
    assert result.leetcode is not None
    assert (result.leetcode.easy_solved, result.leetcode.medium_solved, result.leetcode.hard_solved) == (20, 12, 3)
    assert result.leetcode.contest_rating == 1540.5
    assert result.leetcode.global_ranking == 12000


@pytest.mark.anyio
async def test_invalid_github_user_returns_unverified_profile() -> None:
    def not_found(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"message": "Not Found"})

    request = ProofOfWorkRequest(github_url="https://github.com/missing-user")
    result = await ProofOfWorkService.verify(
        request,
        transport=httpx.MockTransport(not_found),
    )

    assert result.github is not None
    assert result.github.valid is False
    assert result.status == ProofStatus.UNVERIFIED


@pytest.mark.anyio
async def test_empty_custom_project_is_flagged_high_risk() -> None:
    def empty_repository(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/users/ada":
            return httpx.Response(200, json={"login": "ada"})
        if request.url.path == "/repos/ada/empty-app":
            return httpx.Response(
                200,
                json={
                    "owner": {"login": "ada"},
                    "fork": False,
                    "size": 0,
                    "stargazers_count": 0,
                    "default_branch": "main",
                },
            )
        if request.url.path.endswith("/languages"):
            return httpx.Response(200, json={})
        if request.url.path.endswith("/commits"):
            return httpx.Response(200, json=[])
        return httpx.Response(404, json={"message": "Not found"})

    request = ProofOfWorkRequest.model_validate({
        "github_url": "https://github.com/ada",
        "projects": [{
            "title": "Empty app",
            "code_url": "https://github.com/ada/empty-app",
        }],
    })
    result = await ProofOfWorkService.verify(
        request,
        transport=httpx.MockTransport(empty_repository),
    )

    assert result.projects[0].status == ProofStatus.HIGH_RISK
    assert result.status == ProofStatus.HIGH_RISK


@pytest.mark.anyio
async def test_fork_with_no_commits_ahead_of_source_is_high_risk() -> None:
    def forked_repository(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/users/ada":
            return httpx.Response(200, json={"login": "ada"})
        if request.url.path == "/repos/ada/forked-app":
            return httpx.Response(
                200,
                json={
                    "owner": {"login": "ada"},
                    "fork": True,
                    "size": 20,
                    "stargazers_count": 0,
                    "default_branch": "main",
                    "parent": {
                        "owner": {"login": "upstream"},
                        "name": "app",
                        "default_branch": "main",
                    },
                },
            )
        if request.url.path.endswith("/languages"):
            return httpx.Response(200, json={"Python": 200})
        if request.url.path.endswith("/commits"):
            return httpx.Response(
                200,
                json=[{
                    "commit": {
                        "author": {
                            "date": datetime.now(timezone.utc).isoformat(),
                        }
                    }
                }],
            )
        if "/compare/" in request.url.path:
            return httpx.Response(200, json={"ahead_by": 0})
        return httpx.Response(404, json={"message": "Not found"})

    request = ProofOfWorkRequest.model_validate({
        "github_url": "https://github.com/ada",
        "projects": [{
            "title": "Forked app",
            "code_url": "https://github.com/ada/forked-app",
        }],
    })
    result = await ProofOfWorkService.verify(
        request,
        transport=httpx.MockTransport(forked_repository),
    )

    assert result.projects[0].status == ProofStatus.HIGH_RISK
    assert "no commits ahead" in result.projects[0].reasons[0]


@pytest.mark.anyio
async def test_rate_limited_github_user_is_reported_explicitly() -> None:
    def rate_limited(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"message": "API rate limit exceeded"})

    request = ProofOfWorkRequest(github_url="https://github.com/ada")

    with pytest.raises(ProofOfWorkRateLimitError, match="rate limit"):
        await ProofOfWorkService.verify(
            request,
            transport=httpx.MockTransport(rate_limited),
        )


def test_extracts_profiles_from_project_bullets() -> None:
    request = ProofOfWorkRequest.model_validate({
        "projects": [{
            "title": "Open source",
            "bullet_points": [
                "GitHub profile: https://github.com/ada",
                "Code: https://github.com/ada/portfolio",
                "Practice: https://leetcode.com/u/ada/",
            ],
        }]
    })

    assert extract_profile_usernames(request) == ("ada", "ada")


def test_proof_score_uses_only_available_signals() -> None:
    verified = VerifiedProject(title="App", status=ProofStatus.VERIFIED)
    unverified = VerifiedProject(title="Other", status=ProofStatus.UNVERIFIED)
    high_risk = VerifiedProject(title="Empty", status=ProofStatus.HIGH_RISK)

    assert calculate_proof_score([verified], None, None) == 100
    assert calculate_proof_score([verified, unverified], None, None) == 68
    assert calculate_proof_score([high_risk], None, None) == 0
    assert calculate_proof_score(
        [],
        GitHubStats(
            valid=True,
            recent_commits=10,
            stars=100,
            top_languages={"Python": 100},
        ),
        LeetCodeStats(valid=False),
    ) == 94
    assert calculate_proof_score([], None, None) == 0


def test_endpoint_is_registered_and_supports_no_links_fallback() -> None:
    response = TestClient(app).post("/api/v1/verify/proof-of-work", json={})

    assert response.status_code == 200
    assert response.json()["score"] == 0
    assert response.json()["projects"] == []
    assert "Add GitHub or LeetCode" in response.json()["summary"]


def test_endpoint_maps_provider_rate_limit_to_service_unavailable(monkeypatch) -> None:
    async def rate_limited(_request: ProofOfWorkRequest) -> ProofOfWorkResponse:
        raise ProofOfWorkRateLimitError("GitHub API rate limit reached.")

    monkeypatch.setattr(ProofOfWorkService, "verify", rate_limited)
    response = TestClient(app).post(
        "/api/v1/verify/proof-of-work",
        json={"github_url": "https://github.com/ada"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "GitHub API rate limit reached."


def test_proof_of_work_endpoint_has_per_ip_rate_limit(monkeypatch) -> None:
    client_host = "192.0.2.79"
    memory_key = f"proof-of-work:{client_host}"
    monkeypatch.setattr(settings, "redis_url", None)
    monkeypatch.setattr(settings, "app_env", "development")
    _memory_windows.pop(memory_key, None)
    request = Request({
        "type": "http",
        "headers": [],
        "client": (client_host, 12345),
    })

    async def consume_requests() -> None:
        for _ in range(PROOF_OF_WORK_LIMIT):
            await enforce_proof_of_work_rate_limit(request)
        with pytest.raises(HTTPException) as exception:
            await enforce_proof_of_work_rate_limit(request)
        assert exception.value.status_code == 429

    asyncio.run(consume_requests())
