from types import SimpleNamespace
from datetime import datetime, timezone
from unittest.mock import Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.resume import (
    CustomResumeSection,
    ResumeDesignSettings,
    ResumeResponse,
    ResumeUpdate,
)
from app.schemas.career_profile import CareerProfileCreate, CareerProfileUpdate
from app.services.resume_preview_service import jinja_env


def test_design_settings_enforce_supported_values_and_ranges():
    settings = ResumeDesignSettings(
        layout="two-column",
        font_size=10.5,
        spacing="compact",
        accent_color="#2A7BB8",
        page_size="Letter",
    )

    assert settings.layout == "two-column"
    assert settings.font_size == 10.5
    assert settings.page_size == "Letter"
    assert ResumeDesignSettings(font_family="Roboto").font_family == "Roboto"
    assert ResumeDesignSettings(font_family="Merriweather").font_family == "Merriweather"

    with pytest.raises(ValidationError):
        ResumeDesignSettings(font_size=14)
    with pytest.raises(ValidationError):
        ResumeDesignSettings(font_size=9)
    with pytest.raises(ValidationError):
        ResumeDesignSettings(accent_color="blue")
    with pytest.raises(ValidationError):
        ResumeDesignSettings(font_family="Comic Sans")
    with pytest.raises(ValidationError):
        ResumeDesignSettings(font_family="Tahoma")


def test_resume_response_normalizes_legacy_typography_settings():
    response = ResumeResponse.model_validate({
        "id": uuid4(),
        "career_profile_id": uuid4(),
        "title": "Legacy resume",
        "target_role": None,
        "template_name": "modern",
        "is_primary": False,
        "custom_sections": [],
        "design_settings": {
            "layout": "single-column",
            "font_family": "Roboto",
            "font_size": 11,
            "spacing": "comfortable",
            "accent_color": "#147f89",
            "page_size": "A4",
        },
        "section_order": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })

    assert response.design_settings.font_family == "Roboto"
    assert response.design_settings.font_size == 10


def test_leetcode_profile_url_is_validated_and_rendered():
    url = "https://leetcode.com/u/alex-example/"
    profile = CareerProfileCreate(
        profile_type="fresher",
        full_name="Alex Example",
        leetcode_url=url,
    )
    update = CareerProfileUpdate(leetcode_url=url)

    assert str(profile.leetcode_url) == url
    assert str(update.leetcode_url) == url
    with pytest.raises(ValidationError):
        CareerProfileUpdate(leetcode_url="not-a-url")


def test_custom_section_limits_and_unique_ids_are_validated():
    section_id = uuid4()
    section = CustomResumeSection(
        id=section_id,
        section_type="language",
        title="Languages",
        entries=[{"title": "English", "subtitle": "Fluent"}],
    )

    assert section.entries[0].title == "English"
    with pytest.raises(ValidationError):
        ResumeUpdate.model_validate({
            "custom_sections": [
                section.model_dump(),
                section.model_dump(),
            ],
        })
    with pytest.raises(ValidationError):
        CustomResumeSection(
            id=uuid4(),
            section_type="language",
            title="x",
        )

def test_resume_section_order_rejects_duplicates_and_unknown_sections():
    with pytest.raises(ValidationError):
        ResumeUpdate.model_validate({
            "section_order": ["education", "education"],
        })
    with pytest.raises(ValidationError):
        ResumeUpdate.model_validate({"section_order": ["unknown"]})


def test_custom_sections_and_design_settings_render_in_preview_template():
    template = jinja_env.get_template("resumes/modern.html")
    rendered = template.render(
        resume=SimpleNamespace(
            title="Resume",
            source_text="Original raw resume text",
        ),
        profile=SimpleNamespace(
            full_name="Alex Example",
            professional_title=None,
            email=None,
            phone=None,
            city=None,
            linkedin_url=None,
            github_url=None,
            leetcode_url="https://leetcode.com/u/alex-example/",
            portfolio_url=None,
            summary="Parsed professional summary",
        ),
        sections={
            "work_experience": [],
            "technical_skill": [],
            "project": [],
            "education": [],
            "certification": [],
            "achievement": [],
        },
        custom_sections=[{
            "id": str(uuid4()),
            "section_type": "language",
            "title": "Languages",
            "entries": [{
                "title": "English",
                "subtitle": "Fluent",
                "date": None,
                "location": None,
                "url": None,
                "description": None,
            }],
        }],
        section_positions={
            "summary": 1,
            "uploaded_resume": 2,
            "work_experience": 3,
            "technical_skill": 4,
            "project": 5,
            "education": 6,
            "certification": 7,
            "achievement": 8,
        },
        design_settings=ResumeDesignSettings(
            layout="two-column",
            font_family="Georgia",
            font_size=10,
            spacing="spacious",
            accent_color="#123456",
            page_size="Letter",
        ).model_dump(),
    )

    assert "Languages" in rendered
    assert "English" in rendered
    assert "Parsed professional summary" in rendered
    assert "Original raw resume text" not in rendered
    assert "leetcode.com/u/alex-example" in rendered
    assert 'data-layout="two-column"' in rendered
    assert "8.5in" in rendered
    assert "#123456" in rendered
    assert "font: 10px/1.3 Georgia" in rendered
    assert "font-size: 22px" in rendered
    assert "font-size: 13px" in rendered
    assert "break-after: avoid-page" in rendered


def test_url_alias_uses_domain_and_path_without_protocol():
    from app.services.resume_preview_service import url_alias

    assert url_alias("https://www.github.com/example/project/?tab=readme") == "github.com/example/project"


def test_optimized_uploaded_bullet_is_saved_as_a_resume_draft():
    from app.services.resume_content_override_service import ResumeContentOverrideService

    resume_id = uuid4()
    resume = SimpleNamespace(
        id=resume_id,
        source_text="Improved API calls.\nBuilt a service.",
    )
    resume_query = Mock()
    resume_query.filter.return_value.first.return_value = resume
    override_query = Mock()
    override_query.filter.return_value.first.return_value = None
    db = Mock()
    db.query.side_effect = [resume_query, override_query]

    override = ResumeContentOverrideService.apply_bullet_override(
        db,
        resume_id,
        "Improved API calls.",
        "Accomplished reliable APIs as measured by [verified metric], by doing improved API calls.",
    )

    assert override.resume_id == resume_id
    assert override.section_type == "uploaded_resume"
    assert override.field_name == "source_text"
    assert override.is_draft is True
    assert "Accomplished reliable APIs" in override.content
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(override)
