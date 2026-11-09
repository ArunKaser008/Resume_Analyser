import pytest
from pydantic import ValidationError

from app.schemas.resume import ResumeCreate, ResumeUpdate
from app.schemas.resume_template import AVAILABLE_TEMPLATES, ResumeTemplateUpdate
from app.services.resume_preview_service import AVAILABLE_TEMPLATES as PREVIEW_TEMPLATES
from app.services.resume_preview_service import BASE_TEMPLATES, jinja_env
from app.services.resume_template_service import AVAILABLE_TEMPLATES as UPDATE_TEMPLATES


def test_all_resume_templates_are_supported_by_create_update_and_preview():
    assert len(AVAILABLE_TEMPLATES) >= 10
    assert AVAILABLE_TEMPLATES == PREVIEW_TEMPLATES == UPDATE_TEMPLATES

    for template_name in AVAILABLE_TEMPLATES:
        assert ResumeCreate(title="Taylor Resume", template_name=template_name).template_name == template_name
        assert ResumeUpdate(template_name=template_name).template_name == template_name
        assert ResumeTemplateUpdate(template_name=template_name).template_name == template_name
        base_template = template_name if template_name in BASE_TEMPLATES else "modern"
        assert jinja_env.get_template(f"resumes/{base_template}.html")


def test_unsupported_resume_template_is_rejected():
    with pytest.raises(ValidationError):
        ResumeTemplateUpdate(template_name="unsupported")
