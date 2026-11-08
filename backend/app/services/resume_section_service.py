from uuid import UUID

from sqlalchemy.orm import Session

from app.models.education import Education
from app.models.work_experience import WorkExperience
from app.models.technical_skill import TechnicalSkill
from app.models.project import Project
from app.models.certification import Certification
from app.models.achievement import Achievement

from app.repositories.resume_section_repository import (
    ResumeSectionRepository,
)


SECTION_MODELS = {
    "education": Education,
    "work_experience": WorkExperience,
    "technical_skill": TechnicalSkill,
    "project": Project,
    "certification": Certification,
    "achievement": Achievement,
}


class ResumeSectionService:

    @staticmethod
    def save_sections(
        db: Session,
        resume_id: UUID,
        sections: list,
    ):
        resume = ResumeSectionRepository.get_resume(db, resume_id)

        if not resume:
            raise LookupError("Resume not found")

        for section in sections:
            model_class = SECTION_MODELS[section.section_type]

            item_ids = [item.item_id for item in section.items]

            if len(item_ids) != len(set(item_ids)):
                raise ValueError(
                    f"Duplicate items found in section: {section.section_type}"
                )

            validated_items = []

            for item in section.items:
                belongs_to_profile = (
                    ResumeSectionRepository.item_belongs_to_profile(
                        db=db,
                        model_class=model_class,
                        item_id=item.item_id,
                        career_profile_id=resume.career_profile_id,
                    )
                )

                if not belongs_to_profile:
                    raise ValueError(
                        f"Invalid item {item.item_id} for section "
                        f"{section.section_type}. The item does not belong "
                        "to this resume's career profile."
                    )

                validated_items.append(
                    {
                        "item_id": item.item_id,
                        "display_order": item.display_order,
                    }
                )

            ResumeSectionRepository.replace_section(
                db=db,
                resume_id=resume_id,
                section_type=section.section_type,
                items=validated_items,
            )

        return ResumeSectionService.get_sections(db, resume_id)

    @staticmethod
    def get_sections(db: Session, resume_id: UUID):
        resume = ResumeSectionRepository.get_resume(db, resume_id)

        if not resume:
            raise LookupError("Resume not found")

        records = ResumeSectionRepository.get_sections(db, resume_id)

        grouped_sections = {}

        for record in records:
            grouped_sections.setdefault(record.section_type, []).append(
                {
                    "item_id": record.item_id,
                    "display_order": record.display_order,
                }
            )

        return {
            "resume_id": resume_id,
            "sections": [
                {
                    "section_type": section_type,
                    "items": items,
                }
                for section_type, items in grouped_sections.items()
            ],
        }