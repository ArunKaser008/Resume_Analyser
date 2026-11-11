from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.resume import (
    CustomResumeSection,
    ResumeDesignSettings,
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
        resume=SimpleNamespace(title="Resume", source_text=None),
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
            summary=None,
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
