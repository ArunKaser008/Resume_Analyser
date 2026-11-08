from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.resume import (
    CustomResumeSection,
    ResumeDesignSettings,
    ResumeUpdate,
)
from app.services.resume_preview_service import jinja_env


def test_design_settings_enforce_supported_values_and_ranges():
    settings = ResumeDesignSettings(
        layout="two-column",
        font_size=14,
        spacing="compact",
        accent_color="#2A7BB8",
        page_size="Letter",
    )

    assert settings.layout == "two-column"
    assert settings.font_size == 14
    assert settings.page_size == "Letter"

    with pytest.raises(ValidationError):
        ResumeDesignSettings(font_size=20)
    with pytest.raises(ValidationError):
        ResumeDesignSettings(accent_color="blue")
    with pytest.raises(ValidationError):
        ResumeDesignSettings(font_family="Comic Sans")


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
            font_size=13,
            spacing="spacious",
            accent_color="#123456",
            page_size="Letter",
        ).model_dump(),
    )

    assert "Languages" in rendered
    assert "English" in rendered
    assert 'data-layout="two-column"' in rendered
    assert "8.5in" in rendered
    assert "#123456" in rendered
