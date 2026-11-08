
import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.models.resume_optimization_session import ResumeOptimizationSession
from app.models.resume_optimization_suggestion import ResumeOptimizationSuggestion
from app.models.resume_content_override import ResumeContentOverride
from app.models.work_experience import WorkExperience
from app.models.project import Project


logger = logging.getLogger(__name__)


class ResumeContentOverrideService:

    ALLOWED_TARGETS = {
        "summary": {
            "target_field": "summary",
            "requires_item": False,
        },
        "experience": {
            "target_field": "description",
            "requires_item": True,
        },
        "project": {
            "target_fields": {
                "description",
                "responsibilities",
                "achievements",
            },
            "requires_item": True,
        },
    }

    SECTION_TYPE_MAPPING = {
        "experience": "work_experience",
    }

    @staticmethod
    def _get_suggestion(db: Session, suggestion_id: UUID):
        suggestion = (
            db.query(ResumeOptimizationSuggestion)
            .filter(
                ResumeOptimizationSuggestion.id == suggestion_id
            )
            .first()
        )

        if not suggestion:
            raise LookupError("Optimization suggestion not found.")

        return suggestion

    @staticmethod
    def _get_resume_and_session(db: Session, suggestion):
        session = (
            db.query(ResumeOptimizationSession)
            .filter(
                ResumeOptimizationSession.id == suggestion.session_id
            )
            .first()
        )

        if not session:
            raise LookupError("Optimization session not found.")

        resume = (
            db.query(Resume)
            .filter(Resume.id == session.resume_id)
            .first()
        )

        if not resume:
            raise LookupError("Resume not found.")

        return resume, session

    @staticmethod
    def _validate_source_item(
        db: Session,
        resume: Resume,
        section_type: str,
        target_item_id: UUID,
    ):
        if section_type == "experience":
            item = (
                db.query(WorkExperience)
                .filter(
                    WorkExperience.id == target_item_id,
                    WorkExperience.career_profile_id
                    == resume.career_profile_id,
                )
                .first()
            )

        elif section_type == "project":
            item = (
                db.query(Project)
                .filter(
                    Project.id == target_item_id,
                    Project.career_profile_id
                    == resume.career_profile_id,
                )
                .first()
            )

        else:
            raise ValueError("Unsupported suggestion section type.")

        if not item:
            raise ValueError(
                "Target item does not belong to this resume's career profile."
            )

        return item

    @classmethod
    def _validate_target(
        cls,
        section_type: str,
        target_field: str,
        target_item_id: UUID | None,
    ):
        if section_type not in cls.ALLOWED_TARGETS:
            raise ValueError(
                f"Unsupported suggestion type: {section_type}"
            )

        config = cls.ALLOWED_TARGETS[section_type]

        if section_type == "project":
            if target_field not in config["target_fields"]:
                raise ValueError(
                    "Invalid target field for project suggestion."
                )
        elif target_field != config["target_field"]:
            raise ValueError(
                f"Invalid target field for {section_type} suggestion."
            )

        requires_item = config["requires_item"]

        if requires_item and target_item_id is None:
            raise ValueError(
                "A target item ID is required for this suggestion."
            )

        if not requires_item and target_item_id is not None:
            raise ValueError(
                "A target item ID must not be provided for summary suggestions."
            )

    @classmethod
    def apply_suggestion(
        cls,
        db: Session,
        suggestion_id: UUID,
        target_field: str,
        target_item_id: UUID | None = None,
    ):
        """
        Apply an accepted AI suggestion as a resume-specific override.

        Original Career Profile, Work Experience and Project records
        remain unchanged.
        """

        try:
            suggestion = cls._get_suggestion(
                db,
                suggestion_id,
            )

            if suggestion.status != "accepted":
                raise ValueError(
                    "Only accepted suggestions can be applied."
                )

            resume, _ = cls._get_resume_and_session(
                db,
                suggestion,
            )

            section_type = suggestion.suggestion_type

            cls._validate_target(
                section_type=section_type,
                target_field=target_field,
                target_item_id=target_item_id,
            )

            # Require the accepted suggestion's target field to match.
            if suggestion.target_field != target_field:
                raise ValueError(
                    "Target field does not match the accepted suggestion."
                )

            # Require the accepted suggestion's source item to match.
            if section_type in {"experience", "project"}:
                if suggestion.source_item_id is None:
                    raise ValueError(
                        "The accepted suggestion has no source item ID."
                    )

                if suggestion.source_item_id != target_item_id:
                    raise ValueError(
                        "Target item does not match the accepted suggestion."
                    )

            elif suggestion.source_item_id is not None:
                raise ValueError(
                    "Summary suggestions must not reference a source item."
                )

            if target_item_id is not None:
                cls._validate_source_item(
                    db=db,
                    resume=resume,
                    section_type=section_type,
                    target_item_id=target_item_id,
                )

            if (
                not suggestion.suggested_text
                or not suggestion.suggested_text.strip()
            ):
                raise ValueError(
                    "The suggestion does not contain valid content."
                )

            override_section_type = cls.SECTION_TYPE_MAPPING.get(
                section_type,
                section_type,
            )

            existing_override = (
                db.query(ResumeContentOverride)
                .filter(
                    ResumeContentOverride.resume_id == resume.id,
                    ResumeContentOverride.section_type
                    == override_section_type,
                    ResumeContentOverride.source_item_id
                    == target_item_id,
                    ResumeContentOverride.field_name == target_field,
                )
                .first()
            )

            if existing_override:
                existing_override.content = suggestion.suggested_text
                existing_override.suggestion_id = suggestion.id
                override = existing_override
            else:
                override = ResumeContentOverride(
                    resume_id=resume.id,
                    suggestion_id=suggestion.id,
                    section_type=override_section_type,
                    source_item_id=target_item_id,
                    field_name=target_field,
                    content=suggestion.suggested_text,
                )
                db.add(override)

            db.commit()
            db.refresh(override)

            logger.info(
                "Applied optimization suggestion %s to resume %s",
                suggestion.id,
                resume.id,
            )

            return override

        except (LookupError, ValueError):
            db.rollback()
            raise

        except Exception:
            db.rollback()
            logger.exception(
                "Failed to apply resume optimization suggestion %s",
                suggestion_id,
            )
            raise

    @staticmethod
    def get_overrides(
        db: Session,
        resume_id: UUID,
    ):
        resume = (
            db.query(Resume)
            .filter(Resume.id == resume_id)
            .first()
        )

        if not resume:
            raise LookupError("Resume not found.")

        return (
            db.query(ResumeContentOverride)
            .filter(
                ResumeContentOverride.resume_id == resume_id
            )
            .order_by(
                ResumeContentOverride.created_at.asc()
            )
            .all()
        )

    @staticmethod
    def get_override(
        db: Session,
        resume_id: UUID,
        override_id: UUID,
    ):
        return (
            db.query(ResumeContentOverride)
            .filter(
                ResumeContentOverride.id == override_id,
                ResumeContentOverride.resume_id == resume_id,
            )
            .first()
        )

    @classmethod
    def delete_override(
        cls,
        db: Session,
        resume_id: UUID,
        override_id: UUID,
    ):
        try:
            override = cls.get_override(
                db,
                resume_id,
                override_id,
            )

            if not override:
                raise LookupError(
                    "Resume content override not found."
                )

            db.delete(override)
            db.commit()

            logger.info(
                "Deleted content override %s from resume %s",
                override_id,
                resume_id,
            )

            return True

        except LookupError:
            db.rollback()
            raise

        except Exception:
            db.rollback()
            logger.exception(
                "Failed to delete resume content override %s",
                override_id,
            )
            raise
