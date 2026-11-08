from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.models.education import Education
from app.models.work_experience import WorkExperience
from app.models.technical_skill import TechnicalSkill
from app.models.project import Project
from app.models.certification import Certification
from app.models.achievement import Achievement
from app.models.resume_section_item import ResumeSectionItem


SECTION_MODELS = {
    "education": Education,
    "work_experience": WorkExperience,
    "technical_skill": TechnicalSkill,
    "project": Project,
    "certification": Certification,
    "achievement": Achievement,
}


class ResumePreviewRepository:

    @staticmethod
    def get_resume(db: Session, resume_id: UUID):
        return (
            db.query(Resume)
            .filter(Resume.id == resume_id)
            .first()
        )

    @staticmethod
    def get_section_items(db: Session, resume_id: UUID):
        return (
            db.query(ResumeSectionItem)
            .filter(ResumeSectionItem.resume_id == resume_id)
            .order_by(
                ResumeSectionItem.section_type,
                ResumeSectionItem.display_order,
            )
            .all()
        )

    @staticmethod
    def get_profile_items(
        db: Session,
        model_class,
        item_ids: list[UUID],
        career_profile_id: UUID,
    ):
        if not item_ids:
            return []

        return (
            db.query(model_class)
            .filter(
                model_class.id.in_(item_ids),
                model_class.career_profile_id == career_profile_id,
            )
            .all()
        )