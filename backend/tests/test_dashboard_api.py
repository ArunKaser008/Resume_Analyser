from uuid import uuid4
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.v1.dashboard import router
from app.core.database import get_db
from app.core.rate_limit import enforce_bullet_optimizer_rate_limit, enforce_proof_of_work_rate_limit
from app.main import app
from app.schemas.dashboard import (
    CopilotChatResponse,
    DashboardResponse,
    DashboardScoreBreakdown,
    InterviewPrepResponse,
    TierCheck,
    TierSimulationResponse,
    TierType,
)
from app.schemas.proof_of_work import ProofOfWorkRequest, ProofOfWorkResponse, ProofStatus
from app.services.simulator_service import SimulatorService


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = lambda: object()
    app.dependency_overrides[enforce_bullet_optimizer_rate_limit] = lambda: None
    app.dependency_overrides[enforce_proof_of_work_rate_limit] = lambda: None
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _dashboard(resume_id):
    return DashboardResponse(
        analysis_id=resume_id,
        resume_id=resume_id,
        overall_score=75,
        ats_grade="B",
        target_role="Backend Engineer",
        score_breakdown=DashboardScoreBreakdown(
            hard_skills=70, formatting=80, proof_of_work=75, leadership=70,
        ),
        top_priority_fixes=[],
        annotated_sections=[],
    )


def test_get_dashboard_success_not_found_and_server_error(client, monkeypatch):
    resume_id = uuid4()
    monkeypatch.setattr("app.api.v1.dashboard.DashboardService.build", lambda db, value: _dashboard(value))
    success = client.get(f"/api/v1/dashboard/{resume_id}")
    assert success.status_code == 200
    assert success.json()["analysis_id"] == str(resume_id)
    assert client.get("/api/v1/dashboard/not-a-uuid").status_code == 422

    def missing(*_args):
        raise LookupError("Resume not found")

    monkeypatch.setattr("app.api.v1.dashboard.DashboardService.build", missing)
    assert client.get(f"/api/v1/dashboard/{resume_id}").status_code == 404

    monkeypatch.setattr(
        "app.api.v1.dashboard.DashboardService.build",
        lambda *_args: (_ for _ in ()).throw(RuntimeError("database failure")),
    )
    assert client.get(f"/api/v1/dashboard/{resume_id}").status_code == 500


def test_simulate_tier_success_validation_and_server_error(client, monkeypatch):
    resume_id = uuid4()
    monkeypatch.setattr(
        "app.api.v1.dashboard.SimulatorService.proof_request",
        lambda *_args: ProofOfWorkRequest(),
    )
    monkeypatch.setattr(
        "app.api.v1.dashboard.SimulatorService.simulate",
        lambda _db, value, tier, *_proof: TierSimulationResponse(
            resume_id=value,
            tier_type=tier,
            overall_score=80,
            score_breakdown=DashboardScoreBreakdown(
                hard_skills=80, formatting=80, proof_of_work=80, leadership=80,
            ),
            checks=[TierCheck(name="Skills", passed=True, score=100, detail="Found.")],
        ),
    )
    response = client.post(
        "/api/v1/dashboard/simulate-tier",
        json={"resume_id": str(resume_id), "tier_type": "MAANG_PRODUCT"},
    )
    assert response.status_code == 200
    assert response.json()["tier_type"] == TierType.MAANG_PRODUCT.value
    assert client.post("/api/v1/dashboard/simulate-tier", json={}).status_code == 422

    monkeypatch.setattr(
        "app.api.v1.dashboard.SimulatorService.simulate",
        lambda *_args: (_ for _ in ()).throw(RuntimeError("database failure")),
    )
    assert client.post(
        "/api/v1/dashboard/simulate-tier",
        json={"resume_id": str(resume_id), "tier_type": "MAANG_PRODUCT"},
    ).status_code == 500


@pytest.mark.parametrize(
    ("path", "body", "service_path", "response"),
    [
        (
            "/api/v1/dashboard/interview-prep",
            {"resume_id": "00000000-0000-0000-0000-000000000001"},
            "app.api.v1.dashboard.InterviewPrepService.generate",
            InterviewPrepResponse(
                resume_id="00000000-0000-0000-0000-000000000001",
                technical_probes=[
                    {"question": f"Probe {index}", "resume_claim": "Built an API", "evaluation_focus": "Scale"}
                    for index in range(3)
                ],
                gap_traps=[
                    {"weak_area": f"Gap {index}", "interviewer_question": "How?", "suggested_talking_points": ["Explain evidence"]}
                    for index in range(2)
                ],
            ),
        ),
        (
            "/api/v1/dashboard/copilot-chat",
            {"resume_id": "00000000-0000-0000-0000-000000000001", "message": "Improve this bullet"},
            "app.api.v1.dashboard.ResumeCopilotService.answer",
            CopilotChatResponse(resume_id="00000000-0000-0000-0000-000000000001", message="Use a specific action and outcome."),
        ),
    ],
)
def test_llm_endpoints_success_validation_and_server_error(
    client, monkeypatch, path, body, service_path, response,
):
    monkeypatch.setattr(service_path, lambda *_args: response)
    assert client.post(path, json=body).status_code == 200
    assert client.post(path, json={}).status_code == 422
    monkeypatch.setattr(
        service_path,
        lambda *_args: (_ for _ in ()).throw(RuntimeError("unexpected failure")),
    )
    assert client.post(path, json=body).status_code == 500


def test_tier_simulator_uses_distinct_company_emphases(monkeypatch):
    resume_id = uuid4()
    resume = SimpleNamespace(
        target_role="Backend Engineer",
        career_profile=SimpleNamespace(professional_title="Backend Engineer"),
    )
    resume_data = {
        "source_text": "Python project shipped to production with 20% throughput improvement. "
        "System architecture. Education: Bachelor's degree.",
        "resume_text": "",
        "sections": {"education": ["degree"], "project": ["app"]},
    }
    monkeypatch.setattr(
        "app.services.simulator_service.ResumeAnalysisService._get_resume",
        lambda *_args: resume,
    )
    monkeypatch.setattr(
        "app.services.simulator_service.ResumeAnalysisService.get_resume_data",
        lambda *_args: resume_data,
    )

    scores = {
        SimulatorService.simulate(object(), resume_id, tier).overall_score
        for tier in TierType
    }
    assert len(scores) > 1


def test_maang_simulation_uses_verified_public_work(client, monkeypatch):
    resume_id = uuid4()
    captured = {}
    monkeypatch.setattr(
        "app.api.v1.dashboard.SimulatorService.proof_request",
        lambda *_args: ProofOfWorkRequest(github_url="https://github.com/candidate"),
    )

    async def verify(_request):
        return ProofOfWorkResponse(
            score=91,
            status=ProofStatus.VERIFIED,
            summary="Public evidence supports the submitted claims.",
        )

    monkeypatch.setattr("app.api.v1.dashboard.ProofOfWorkService.verify", verify)

    def simulate(_db, value, tier, proof_score, proof_verified):
        captured.update(proof_score=proof_score, proof_verified=proof_verified)
        return TierSimulationResponse(
            resume_id=value,
            tier_type=tier,
            overall_score=80,
            score_breakdown=DashboardScoreBreakdown(
                hard_skills=80,
                formatting=80,
                proof_of_work=proof_score,
                leadership=80,
            ),
            checks=[],
        )

    monkeypatch.setattr("app.api.v1.dashboard.SimulatorService.simulate", simulate)
    response = client.post(
        "/api/v1/dashboard/simulate-tier",
        json={"resume_id": str(resume_id), "tier_type": "MAANG_PRODUCT"},
    )
    assert response.status_code == 200
    assert captured == {"proof_score": 91, "proof_verified": True}
