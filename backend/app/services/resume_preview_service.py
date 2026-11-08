from pathlib import Path
from uuid import UUID

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session

from app.repositories.resume_preview_repository import (
    ResumePreviewRepository,
    SECTION_MODELS,
)


TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"

jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)

AVAILABLE_TEMPLATES = {
    "modern",
    "professional",
    "minimal",
}


class ResumePreviewService:

    @staticmethod
    def generate_preview(db: Session, resume_id: UUID) -> str:
        resume = ResumePreviewRepository.get_resume(db, resume_id)

        if not resume:
            raise LookupError("Resume not found")

        profile = resume.career_profile

        if not profile:
            raise LookupError("Career profile not found")

        template_name = resume.template_name or "modern"

        if template_name not in AVAILABLE_TEMPLATES:
            raise ValueError("Invalid resume template configured")

        selected_items = ResumePreviewRepository.get_section_items(
            db=db,
            resume_id=resume_id,
        )

        grouped_items = {}

        for selected_item in selected_items:
            grouped_items.setdefault(
                selected_item.section_type, []
            ).append(selected_item)

        resume_sections = {}

        for section_type, model_class in SECTION_MODELS.items():
            section_items = grouped_items.get(section_type, [])
            section_items.sort(key=lambda item: item.display_order)

            item_ids = [item.item_id for item in section_items]

            records = ResumePreviewRepository.get_profile_items(
                db=db,
                model_class=model_class,
                item_ids=item_ids,
                career_profile_id=profile.id,
            )

            records_by_id = {record.id: record for record in records}

            resume_sections[section_type] = [
                records_by_id[item_id]
                for item_id in item_ids
                if item_id in records_by_id
            ]

        template = jinja_env.get_template(
            f"resumes/{template_name}.html"
        )

        return template.render(
            resume=resume,
            profile=profile,
            sections=resume_sections,
        )