from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.resume_preview_repository import (
    ResumePreviewRepository,
)
from app.schemas.resume_template import AVAILABLE_TEMPLATES


class ResumeTemplateService:

    @staticmethod
    def update_template(
        db: Session,
        resume_id: UUID,
        template_name: str,
    ):
        resume = ResumePreviewRepository.get_resume(db, resume_id)

        if not resume:
            raise LookupError("Resume not found")

        if template_name not in AVAILABLE_TEMPLATES:
            raise ValueError("Unsupported resume template")

        try:
            resume.template_name = template_name
            db.commit()
            db.refresh(resume)

            return {
                "resume_id": str(resume.id),
                "template_name": resume.template_name,
                "message": "Resume template updated successfully",
            }

        except Exception:
            db.rollback()
            raise