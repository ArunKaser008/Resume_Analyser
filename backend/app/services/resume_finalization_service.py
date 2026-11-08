import logging
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.models.resume_content_override import ResumeContentOverride
from app.models.resume_section_item import ResumeSectionItem


logger = logging.getLogger(__name__)
MAX_SAVED_COPIES = 2


class ResumeFinalizationService:
    @staticmethod
    def _ensure_copy_limit(saved_copies: int) -> None:
        if saved_copies >= MAX_SAVED_COPIES:
            raise ValueError(
                "This resume already has the maximum of two saved copies."
            )

    @staticmethod
    def finalize_changes(
        db: Session,
        resume_id: UUID,
        action: str,
    ) -> tuple[Resume, int]:
        try:
            resume = (
                db.query(Resume)
                .filter(Resume.id == resume_id)
                .with_for_update()
                .first()
            )
            if resume is None:
                raise LookupError("Resume not found.")
            if action not in {"update_existing", "save_copy"}:
                raise ValueError("Choose whether to update the existing resume or save a copy.")

            root_id = resume.parent_resume_id or resume.id
            saved_copies = (
                db.query(func.count(Resume.id))
                .filter(Resume.parent_resume_id == root_id)
                .scalar()
                or 0
            )
            drafts = (
                db.query(ResumeContentOverride)
                .filter(
                    ResumeContentOverride.resume_id == resume.id,
                    ResumeContentOverride.is_draft.is_(True),
                )
                .all()
            )

            if action == "update_existing":
                for override in drafts:
                    override.is_draft = False
                    override.previous_content = None
                    override.draft_created = False
                db.commit()
                db.refresh(resume)
                return resume, saved_copies

            ResumeFinalizationService._ensure_copy_limit(saved_copies)

            copy_number = saved_copies + 1
            copy_title = f"{resume.title[:140]} (Copy {copy_number})"
            saved = Resume(
                career_profile_id=resume.career_profile_id,
                parent_resume_id=root_id,
                title=copy_title,
                target_role=resume.target_role,
                template_name=resume.template_name,
                is_primary=False,
                source_filename=resume.source_filename,
                source_text=resume.source_text,
            )
            db.add(saved)
            db.flush()

            section_items = (
                db.query(ResumeSectionItem)
                .filter(ResumeSectionItem.resume_id == resume.id)
                .all()
            )
            for item in section_items:
                db.add(ResumeSectionItem(
                    resume_id=saved.id,
                    section_type=item.section_type,
                    item_id=item.item_id,
                    display_order=item.display_order,
                ))

            overrides = (
                db.query(ResumeContentOverride)
                .filter(ResumeContentOverride.resume_id == resume.id)
                .all()
            )
            for override in overrides:
                db.add(ResumeContentOverride(
                    resume_id=saved.id,
                    suggestion_id=None,
                    section_type=override.section_type,
                    source_item_id=override.source_item_id,
                    field_name=override.field_name,
                    content=override.content,
                    is_draft=False,
                    previous_content=None,
                    draft_created=False,
                ))

            for override in drafts:
                if override.draft_created:
                    db.delete(override)
                else:
                    override.content = override.previous_content or ""
                    override.is_draft = False
                    override.previous_content = None
                    override.draft_created = False

            db.commit()
            db.refresh(saved)
            logger.info(
                "Saved resume %s as copy %s",
                resume.id,
                saved.id,
            )
            return saved, copy_number
        except (LookupError, ValueError):
            db.rollback()
            raise
        except Exception:
            db.rollback()
            logger.exception(
                "Failed to finalize changes for resume %s",
                resume_id,
            )
            raise
