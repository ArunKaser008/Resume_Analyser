import asyncio
import uuid

import pymupdf
import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.config import settings
from app.core.rate_limit import (
    RESUME_PARSE_LIMIT,
    _memory_windows,
    enforce_resume_parse_rate_limit,
)
from app.main import app
from app.models.resume_parse import ResumeParse
from app.schemas.resume_parsing import ParsedResumeData
from app.services.ai_client import AIResponseError
from app.services.resume_parsing_service import (
    MAX_PARSE_UPLOAD_BYTES,
    ResumeParsingService,
)


class FakeSession:
    def __init__(self) -> None:
        self.records: dict[uuid.UUID, ResumeParse] = {}
        self.added: ResumeParse | None = None

    def add(self, record: ResumeParse) -> None:
        record.id = uuid.uuid4()
        self.added = record

    def commit(self) -> None:
        if self.added is not None:
            self.records[self.added.id] = self.added

    def refresh(self, record: ResumeParse) -> None:
        return None

    def rollback(self) -> None:
        self.added = None

    def get(self, model: type[ResumeParse], record_id: uuid.UUID) -> ResumeParse | None:
        return self.records.get(record_id)


@pytest.fixture
def fake_session() -> FakeSession:
    return FakeSession()


@pytest.fixture
def client(fake_session: FakeSession) -> TestClient:
    app.dependency_overrides[get_db] = lambda: fake_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_extract_pdf_with_standard_text_layout() -> None:
    document = pymupdf.open()
    page = document.new_page()
    page.insert_text((72, 72), "Avery Example\nSoftware Engineer\nPython and React")
    content = document.tobytes()
    document.close()

    extracted = ResumeParsingService.extract_text("resume.pdf", content)

    assert "Avery Example" in extracted
    assert "Python and React" in extracted


def test_extract_pdf_falls_back_to_ocr_when_selectable_text_is_empty(
    monkeypatch,
) -> None:
    document = pymupdf.open()
    document.new_page()
    content = document.tobytes()
    document.close()
    monkeypatch.setattr(
        pymupdf.Page,
        "get_textpage_ocr",
        lambda _page, **_kwargs: object(),
    )
    monkeypatch.setattr(
        pymupdf.Page,
        "get_text",
        lambda _page, _kind, **kwargs: (
            "OCR extracted text" if "textpage" in kwargs else ""
        ),
    )

    extracted = ResumeParsingService.extract_text("scan.pdf", content)

    assert extracted == "OCR extracted text"


def test_parse_text_validates_llm_output_and_normalizes_skills(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.resume_parsing_service.AIClient.generate_json",
        lambda _system, _user: {
            "contact_info": {"email": "avery@example.com"},
            "technical_skills": {
                "languages": ["K8s"],
                "frameworks": ["ReactJS", "React"],
            },
            "experience": [{"company": "Example Co", "title": "Engineer"}],
            "projects": [{"title": "ATS tool", "tech_stack": ["K8s"]}],
        },
    )

    parsed = ResumeParsingService.parse_text("Avery's resume text")

    assert parsed.contact_info.email == "avery@example.com"
    assert parsed.technical_skills.languages == ["Kubernetes"]
    assert parsed.technical_skills.frameworks == ["React"]
    assert parsed.experience[0].company == "Example Co"
    assert parsed.projects[0].tech_stack == ["Kubernetes"]


def test_parse_text_rejects_invalid_structured_llm_response(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.resume_parsing_service.AIClient.generate_json",
        lambda _system, _user: {"contact_info": {"unexpected": "field"}},
    )

    with pytest.raises(AIResponseError, match="did not match"):
        ResumeParsingService.parse_text("Resume text")


def test_parse_endpoint_persists_raw_text_and_structured_data(
    client: TestClient,
    fake_session: FakeSession,
    monkeypatch,
) -> None:
    parsed = ParsedResumeData.model_validate({
        "contact_info": {"full_name": "Avery Example"},
        "technical_skills": {"frameworks": ["React"]},
    })
    monkeypatch.setattr(
        ResumeParsingService,
        "parse_resume",
        lambda _filename, _content: ("Original resume text", parsed),
    )

    response = client.post(
        "/api/v1/resume/parse",
        files={"file": ("resume.txt", b"Original resume text", "text/plain")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["filename"] == "resume.txt"
    assert payload["parsed_data"]["contact_info"]["full_name"] == "Avery Example"
    saved = fake_session.records[uuid.UUID(payload["parse_id"])]
    assert saved.raw_text == "Original resume text"
    assert saved.parsed_data["technical_skills"]["frameworks"] == ["React"]


@pytest.mark.parametrize(
    ("filename", "content"),
    [
        ("resume.exe", b"not a resume"),
        ("resume.png", b"\x89PNG\r\n"),
        ("broken.pdf", b"not a pdf"),
    ],
)
def test_parse_endpoint_returns_400_for_unsupported_or_corrupt_files(
    client: TestClient,
    filename: str,
    content: bytes,
) -> None:
    response = client.post(
        "/api/v1/resume/parse",
        files={"file": (filename, content, "application/octet-stream")},
    )

    assert response.status_code == 400


def test_parse_endpoint_rejects_files_over_5mb(client: TestClient) -> None:
    response = client.post(
        "/api/v1/resume/parse",
        files={
            "file": (
                "large.txt",
                b"a" * (MAX_PARSE_UPLOAD_BYTES + 1),
                "text/plain",
            )
        },
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "Resume files cannot exceed 5 MB."


def test_parse_endpoint_validates_correction_payload(client: TestClient) -> None:
    response = client.put(
        f"/api/v1/resume/parse/{uuid.uuid4()}",
        json={"parsed_data": {"contact_info": {"unexpected": "field"}}},
    )

    assert response.status_code == 422


def test_parse_endpoint_returns_500_for_unexpected_parser_failure(
    client: TestClient,
    monkeypatch,
) -> None:
    def fail_parse(_filename: str, _content: bytes) -> tuple[str, ParsedResumeData]:
        raise RuntimeError("internal")

    monkeypatch.setattr(
        ResumeParsingService,
        "parse_resume",
        fail_parse,
    )

    response = client.post(
        "/api/v1/resume/parse",
        files={"file": ("resume.txt", b"Resume text", "text/plain")},
    )

    assert response.status_code == 500
    assert response.json()["detail"] == "Unable to parse the uploaded resume."


def test_resume_parser_rate_limit_returns_429_after_limit(monkeypatch) -> None:
    client_host = "192.0.2.77"
    monkeypatch.setattr(settings, "redis_url", None)
    _memory_windows.pop(f"resume-parse:{client_host}", None)
    request = Request({
        "type": "http",
        "headers": [],
        "client": (client_host, 12345),
    })

    async def consume_requests() -> None:
        for _ in range(RESUME_PARSE_LIMIT):
            await enforce_resume_parse_rate_limit(request)
        with pytest.raises(HTTPException) as exception:
            await enforce_resume_parse_rate_limit(request)
        assert exception.value.status_code == 429

    asyncio.run(consume_requests())


def test_resume_parser_requires_redis_outside_development(monkeypatch) -> None:
    monkeypatch.setattr(settings, "redis_url", None)
    monkeypatch.setattr(settings, "app_env", "production")
    request = Request({
        "type": "http",
        "headers": [],
        "client": ("192.0.2.78", 12345),
    })

    with pytest.raises(HTTPException) as exception:
        asyncio.run(enforce_resume_parse_rate_limit(request))

    assert exception.value.status_code == 503
