from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.ats_emulator import (
    ATSAnalyzeJDRequest,
    ATSAnalyzeJDResponse,
    ATSScoreBreakdown,
    SenioritySignals,
    TargetATS,
)
from app.services.ats_emulator_service import (
    ATSEmulatorService,
    _html_to_text,
)
from app.services.ai_client import AIResponseError


RESUME_ID = uuid4()


def _stub_resume_service(monkeypatch, *, layout: str = "single-column") -> None:
    resume = SimpleNamespace(
        id=RESUME_ID,
        career_profile_id=uuid4(),
        career_profile=SimpleNamespace(profile_type="experienced"),
        design_settings={"layout": layout},
        custom_sections=[],
    )
    monkeypatch.setattr(
        "app.services.ats_emulator_service.ResumeAnalysisService._get_resume",
        lambda _db, _resume_id: resume,
    )
    monkeypatch.setattr(
        "app.services.ats_emulator_service.ResumeAnalysisService.get_resume_data",
        lambda *_args, **_kwargs: {
            "resume_text": "Avery Engineer Python led teams",
            "source_text": "Avery Engineer\nPython\nExperience",
            "sections": {"work_experience": ["Python led teams"]},
        },
    )
    monkeypatch.setattr(
        "app.services.ats_emulator_service.ResumePreviewService.generate_preview",
        lambda *_args, **_kwargs: (
            "<html><style>.hidden{color:red}</style><h1>Avery Engineer</h1>"
            "<table><tr><td>Python</td><td>Led teams</td></tr></table></html>"
        ),
    )
    monkeypatch.setattr(
        ATSEmulatorService,
        "_formatting_findings",
        staticmethod(lambda *_args: ([], [], 0)),
    )


def test_workday_uses_plain_text_keyword_matching_while_greenhouse_and_lever_use_context(
    monkeypatch,
) -> None:
    _stub_resume_service(monkeypatch)
    calls: list[str] = []

    def semantic_response(
        system_prompt: str,
        user_prompt: str,
        _response_schema: type,
    ) -> dict:
        calls.append(system_prompt)
        assert "<job_description>" in user_prompt
        return {
            "hard_skill_matrix": [{
                "skill": "Python",
                "status": "matched",
                "evidence": ["Built Python services"],
                "rationale": "Direct experience.",
            }],
            "soft_skill_score": 81,
            "experience_alignment_score": 76,
            "seniority_signals": ["led"],
            "recruiter_view": "Relevant Python delivery and team leadership.",
        }

    monkeypatch.setattr(
        "app.services.ats_emulator_service.AIClient.generate_structured_json",
        semantic_response,
    )
    common = {
        "db": object(),
        "resume_id": RESUME_ID,
        "job_description": "Python React Kubernetes engineering role",
    }

    workday = ATSEmulatorService.analyze(**common, target_ats=TargetATS.WORKDAY)
    greenhouse = ATSEmulatorService.analyze(**common, target_ats=TargetATS.GREENHOUSE)
    lever = ATSEmulatorService.analyze(**common, target_ats=TargetATS.LEVER)

    assert next(
        item for item in workday.hard_skill_matrix if item.skill.casefold() == "python"
    ).status == "matched"
    assert any(
        item.skill.casefold() == "react" and item.status == "missing"
        for item in workday.hard_skill_matrix
    )
    assert greenhouse.hard_skill_matrix[0].evidence == ["Built Python services"]
    assert greenhouse.score_breakdown.soft_skills == 81
    assert greenhouse.recruiter_view == "Relevant Python delivery and team leadership."
    assert lever.target_ats == TargetATS.LEVER
    assert len(calls) == 2
    assert "structured resume parsing" in calls[0]
    assert "contextual skill relationships" in calls[1]


def test_empty_job_description_returns_complete_zero_match_response(monkeypatch) -> None:
    _stub_resume_service(monkeypatch, layout="two-column")

    result = ATSEmulatorService.analyze(
        object(),
        resume_id=RESUME_ID,
        job_description=" ",
        target_ats=TargetATS.WORKDAY,
    )

    validated = ATSAnalyzeJDResponse.model_validate(result.model_dump())
    assert validated.overall_match_score == 0
    assert validated.score_breakdown.formatting == 100
    assert validated.target_ats == TargetATS.WORKDAY
    assert validated.parser_warnings
    assert "Avery Engineer" in validated.raw_parser_output
    assert ".hidden" not in validated.raw_parser_output


def test_request_schema_rejects_job_descriptions_above_limit() -> None:
    with pytest.raises(ValueError):
        ATSAnalyzeJDRequest.model_validate({
            "resume_id": RESUME_ID,
            "job_description": "x" * 20_001,
            "target_ats": "LEVER",
        })


def test_html_text_extraction_removes_styles_and_preserves_cell_text() -> None:
    extracted = _html_to_text(
        "<style>.column{display:grid}</style><table><tr>"
        "<td>Skills</td><td>Python</td></tr></table>"
    )

    assert "Skills" in extracted
    assert "Python" in extracted
    assert "display:grid" not in extracted


def test_formatting_findings_include_line_numbers_for_layout_and_missing_dates(
    monkeypatch,
) -> None:
    work_experience = SimpleNamespace(
        job_title="Engineer",
        start_date=None,
        end_date=None,
        is_current=False,
    )
    resume = SimpleNamespace(
        id=RESUME_ID,
        career_profile_id=uuid4(),
        design_settings={"layout": "two-column"},
        custom_sections=[{"title": "Community Work"}],
    )
    monkeypatch.setattr(
        "app.services.ats_emulator_service.ResumePreviewRepository.get_section_items",
        lambda *_args: [
            SimpleNamespace(section_type="work_experience", item_id=uuid4())
        ],
    )
    monkeypatch.setattr(
        "app.services.ats_emulator_service.ResumePreviewRepository.get_profile_items",
        lambda *, model_class, **_kwargs: (
            [work_experience] if model_class.__name__ == "WorkExperience" else []
        ),
    )

    flags, _warnings, risk = ATSEmulatorService._formatting_findings(
        object(),
        resume,
        "Engineer\nCommunity Work\nSkills\tPython",
    )

    assert {flag.category for flag in flags} >= {
        "multi_column_layout",
        "non_standard_section_header",
        "missing_dates",
        "table_or_sidebar_content",
    }
    assert all(flag.line_number is not None for flag in flags)
    assert risk > 0


def test_endpoint_is_registered_and_validates_body(monkeypatch) -> None:
    _stub_resume_service(monkeypatch)
    monkeypatch.setattr(
        "app.services.ats_emulator_service.ResumeAnalysisService._get_resume",
        lambda *_args: SimpleNamespace(
            id=RESUME_ID,
            career_profile_id=uuid4(),
            career_profile=SimpleNamespace(profile_type="experienced"),
            design_settings={},
            custom_sections=[],
        ),
    )
    response = TestClient(app).post(
        "/api/v1/resume/analyze-jd",
        json={
            "resume_id": str(RESUME_ID),
            "job_description": "",
            "target_ats": "WORKDAY",
        },
    )

    assert response.status_code == 200
    assert response.json()["target_ats"] == "WORKDAY"
    assert "formatting_flags" in response.json()


def test_endpoint_rejects_extremely_long_job_description() -> None:
    response = TestClient(app).post(
        "/api/v1/resume/analyze-jd",
        json={
            "resume_id": str(RESUME_ID),
            "job_description": "x" * 20_001,
            "target_ats": "LEVER",
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize("target_ats", list(TargetATS))
def test_simulator_endpoint_retries_malformed_semantic_response(
    monkeypatch,
    target_ats: TargetATS,
) -> None:
    _stub_resume_service(monkeypatch)
    calls: list[tuple[str, str, type]] = []

    def malformed_then_valid(
        system_prompt: str,
        user_prompt: str,
        response_schema: type,
    ) -> dict:
        calls.append((system_prompt, user_prompt, response_schema))
        if target_ats == TargetATS.WORKDAY:
            raise AssertionError("Workday simulation should not call Gemini.")
        if len(calls) == 1:
            raise AIResponseError("Gemini returned an invalid JSON response.")
        return {
            "hard_skill_matrix": [],
            "soft_skill_score": 65,
            "experience_alignment_score": 70,
            "seniority_signals": ["led"],
            "recruiter_view": "Evidence-backed assessment.",
        }

    monkeypatch.setattr(
        "app.services.ats_emulator_service.AIClient.generate_structured_json",
        malformed_then_valid,
    )
    response = TestClient(app).post(
        "/api/v1/resume/analyze-jd",
        json={
            "resume_id": str(RESUME_ID),
            "job_description": "Python engineering experience",
            "target_ats": target_ats.value,
        },
    )

    assert response.status_code == 200
    assert response.json()["target_ats"] == target_ats.value
    if target_ats == TargetATS.WORKDAY:
        assert calls == []
    else:
        assert len(calls) == 2
        assert "strictly valid JSON" in calls[1][1]


def test_simulator_endpoint_returns_gateway_error_after_invalid_response_retry(
    monkeypatch,
) -> None:
    _stub_resume_service(monkeypatch)
    calls = 0

    def always_invalid(*_args) -> dict:
        nonlocal calls
        calls += 1
        raise AIResponseError("Gemini returned an invalid JSON response.")

    monkeypatch.setattr(
        "app.services.ats_emulator_service.AIClient.generate_structured_json",
        always_invalid,
    )
    response = TestClient(app).post(
        "/api/v1/resume/analyze-jd",
        json={
            "resume_id": str(RESUME_ID),
            "job_description": "Python engineering experience",
            "target_ats": TargetATS.GREENHOUSE.value,
        },
    )

    assert response.status_code == 502
    assert response.json()["detail"] == (
        "The ATS semantic assessment returned an invalid response after retry."
    )
    assert calls == 2
