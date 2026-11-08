
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.models.resume_content_override import ResumeContentOverride
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
                selected_item.section_type,
                [],
            ).append(selected_item)

        resume_sections = {}

        for section_type, model_class in SECTION_MODELS.items():
            section_items = grouped_items.get(section_type, [])

            section_items.sort(
                key=lambda item: item.display_order
            )

            item_ids = [
                item.item_id
                for item in section_items
            ]

            if not item_ids:
                resume_sections[section_type] = []
                continue

            records = ResumePreviewRepository.get_profile_items(
                db=db,
                model_class=model_class,
                item_ids=item_ids,
                career_profile_id=profile.id,
            )

            records_by_id = {
                record.id: record
                for record in records
            }

            resume_sections[section_type] = [
                records_by_id[item_id]
                for item_id in item_ids
                if item_id in records_by_id
            ]

        profile, resume_sections, resume = (
            ResumePreviewService._apply_content_overrides(
                db=db,
                resume=resume,
                profile=profile,
                resume_sections=resume_sections,
            )
        )

        template = jinja_env.get_template(
            f"resumes/{template_name}.html"
        )

        return template.render(
            resume=resume,
            profile=profile,
            sections=resume_sections,
        )

    @staticmethod
    def _to_template_object(record):
        """
        Create an independent object containing mapped database columns.

        This prevents preview overrides from modifying SQLAlchemy model
        instances or their original database-backed attributes.
        """

        mapper = inspect(record.__class__)

        values = {
            column.key: getattr(record, column.key)
            for column in mapper.column_attrs
        }

        return SimpleNamespace(**values)

    @staticmethod
    def _apply_content_overrides(
        db: Session,
        resume,
        profile,
        resume_sections: dict,
    ):
        """
        Apply resume-specific overrides to independent template objects.

        Original Career Profile, Work Experience and Project records
        remain unchanged.
        """

        overrides = (
            db.query(ResumeContentOverride)
            .filter(
                ResumeContentOverride.resume_id == resume.id
            )
            .order_by(
                ResumeContentOverride.created_at.asc(),
                ResumeContentOverride.id.asc(),
            )
            .all()
        )

        if not overrides:
            return profile, resume_sections, resume

        resume_data = ResumePreviewService._to_template_object(resume)
        profile_data = (
            ResumePreviewService._to_template_object(profile)
        )

        updated_sections = {
            section_type: [
                ResumePreviewService._to_template_object(record)
                for record in records
            ]
            for section_type, records in resume_sections.items()
        }

        for override in overrides:

            if (
                override.section_type == "uploaded_resume"
                and override.field_name == "source_text"
                and override.source_item_id is None
            ):
                resume_data.source_text = override.content
                continue

            # Summary override.
            if (
                override.section_type == "summary"
                and override.field_name == "summary"
                and override.source_item_id is None
            ):
                profile_data.summary = override.content
                continue

            # Experience and project overrides.
            section_records = updated_sections.get(
                override.section_type,
                [],
            )

            for record in section_records:

                if str(record.id) != str(override.source_item_id):
                    continue

                if hasattr(record, override.field_name):
                    setattr(
                        record,
                        override.field_name,
                        override.content,
                    )

                break

        return profile_data, updated_sections, resume_data
