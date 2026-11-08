
import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.schemas.resume_optimization_review import OptimizationSessionCreate
from app.services.candidate_jd_matching_service import (
    CandidateJDMatchingService,
)
from app.services.resume_optimization_review_service import (
    ResumeOptimizationReviewService,
)

logger = logging.getLogger(__name__)


class ResumeTailoringService:

    @staticmethod
    def _serialize_suggestion(suggestion) -> dict:
        return {
            "id": suggestion.id,
            "session_id": suggestion.session_id,
            "suggestion_type": suggestion.suggestion_type,
            "source_item_id": getattr(
                suggestion, "source_item_id", None
            ),
            "target_field": getattr(
                suggestion, "target_field", None
            ),
            "original_text": suggestion.original_text,
            "suggested_text": suggestion.suggested_text,
            "explanation": suggestion.explanation,
            "status": suggestion.status,
            "created_at": suggestion.created_at,
            "updated_at": getattr(
                suggestion, "updated_at", None
            ),
        }

    @staticmethod
    def _serialize_session(session) -> dict:
        return {
            "id": session.id,
            "resume_id": session.resume_id,
            "target_role": session.target_role,
            "job_description": session.job_description,
            "status": session.status,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
        }

    @classmethod
    def tailor(
        cls,
        db: Session,
        resume_id: UUID,
        job_description: str,
    ) -> dict:

        if not job_description or not job_description.strip():
            raise ValueError("Job description cannot be empty.")

        cleaned_description = job_description.strip()

        if len(cleaned_description) < 100:
            raise ValueError(
                "Job description must contain at least 100 characters."
            )

        if len(cleaned_description) > 20000:
            raise ValueError(
                "Job description cannot exceed 20,000 characters."
            )

        # Step 1: Calculate candidate-to-JD alignment.
        # This internally performs JD extraction.
        match_result = CandidateJDMatchingService.match(
            db=db,
            resume_id=resume_id,
            job_description=cleaned_description,
        )

        # Step 2: Generate and persist optimization suggestions.
        optimization_result = (
            ResumeOptimizationReviewService.create_session(
                db=db,
                resume_id=resume_id,
                request=OptimizationSessionCreate(
                    job_description=cleaned_description
                ),
            )
        )

        session = optimization_result["session"]
        suggestions = optimization_result["suggestions"]

        logger.info(
            "Resume tailoring completed for resume_id=%s, session_id=%s",
            resume_id,
            session.id,
        )

        return {
            "resume_id": resume_id,
            "job_title": match_result.get("job_title"),
            "target_role": match_result.get("target_role"),
            "match_analysis": match_result,
            "optimization_session": cls._serialize_session(session),
            "suggestions": [
                cls._serialize_suggestion(item)
                for item in suggestions
            ],
            "suggestion_count": len(suggestions),
            "message": (
                "Resume analysis and tailoring suggestions generated successfully. "
                "Review the suggestions and accept or reject them individually."
            ),
        }
