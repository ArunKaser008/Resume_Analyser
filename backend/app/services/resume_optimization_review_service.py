import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.models.resume_optimization_session import ResumeOptimizationSession
from app.models.resume_optimization_suggestion import ResumeOptimizationSuggestion

from app.repositories.resume_optimization_review_repository import (
    ResumeOptimizationReviewRepository as Repository,
)
from app.repositories.resume_preview_repository import (
    ResumePreviewRepository,
    SECTION_MODELS,
)

from app.schemas.resume_optimization_review import OptimizationSessionCreate
from app.services.ai_client import AIClient
from app.services.resume_analysis_service import ResumeAnalysisService


logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """
You are an expert ATS resume optimization assistant.

Your task is to improve a candidate's resume for a supplied job description.

STRICT RULES:
1. Never invent skills, experience, qualifications, dates, tools or achievements.
2. Never invent numbers, percentages, metrics or business impact.
3. Preserve the candidate's original meaning and factual information.
4. Improve grammar, clarity, relevance and professional wording.
5. Use only the supplied source records.
6. Do not combine information from different experience or project records.
7. Do not suggest adding a skill unless the candidate's supplied resume supports it.
8. Keep suggestions concise, specific and ATS-friendly.
9. Return valid JSON only. No Markdown or code fences.

For experience suggestions:
- Use suggestion_type "experience".
- Use target_field "description".
- source_item_id MUST be copied from the supplied work experience records.

For project suggestions:
- Use suggestion_type "project".
- Use target_field "description", "responsibilities", or "achievements".
- source_item_id MUST be copied from the supplied project records.

For an uploaded resume document:
- Return uploaded_resume_suggestions with one item per section to improve.
- Copy each original_text exactly from UPLOADED RESUME SOURCE TEXT.
- Keep each change within the same section and preserve factual claims.
- Do not add, remove, or alter facts, dates, skills, employers, or numbers.
- Use a concise section_name, suggested_text, and explanation.

Return exactly this JSON structure:

{
  "optimized_summary": "Improved professional summary",
  "experience_suggestions": [
    {
      "source_item_id": "UUID from supplied work experience records",
      "target_field": "description",
      "suggested_text": "Improved description",
      "explanation": "Why this improvement is relevant"
    }
  ],
  "project_suggestions": [
    {
      "source_item_id": "UUID from supplied project records",
      "target_field": "description",
      "suggested_text": "Improved project description",
      "explanation": "Why this improvement is relevant"
    }
  ],
  "uploaded_resume_suggestions": [
    {
      "section_name": "Experience",
      "original_text": "Exact existing text from one resume section",
      "suggested_text": "Reworded text using only the supplied facts",
      "explanation": "Why this section change is useful"
    }
  ],
  "keywords_to_consider": [],
  "skill_gap_recommendations": [],
  "general_recommendations": [],
  "factuality_notes": []
}

If no valid suggestion exists for a category, return an empty list.
"""


class ResumeOptimizationReviewService:

    EXPERIENCE_FIELDS = {"description"}
    PROJECT_FIELDS = {
        "description",
        "responsibilities",
        "achievements",
    }

    @staticmethod
    def _text(value) -> str:
        if value is None:
            return ""

        if isinstance(value, list):
            return "\n".join(str(item) for item in value)

        return str(value)

    @staticmethod
    def _get_selected_records(db: Session, resume: Resume):
        selected_items = ResumePreviewRepository.get_section_items(
            db=db,
            resume_id=resume.id,
        )

        grouped = {}

        for item in selected_items:
            grouped.setdefault(item.section_type, []).append(item)

        result = {
            "work_experience": [],
            "project": [],
        }

        for section_type in result:
            model_class = SECTION_MODELS.get(section_type)

            if not model_class:
                continue

            items = sorted(
                grouped.get(section_type, []),
                key=lambda item: item.display_order,
            )

            item_ids = [item.item_id for item in items]

            records = ResumePreviewRepository.get_profile_items(
                db=db,
                model_class=model_class,
                item_ids=item_ids,
                career_profile_id=resume.career_profile_id,
            )

            records_by_id = {
                str(record.id): record
                for record in records
            }

            for item in items:
                record = records_by_id.get(str(item.item_id))

                if not record:
                    continue

                result[section_type].append({
                    "id": str(record.id),
                    "text": ResumeAnalysisService._record_to_text(record),
                    "description": ResumeOptimizationReviewService._text(
                        getattr(record, "description", None)
                    ),
                    "responsibilities": ResumeOptimizationReviewService._text(
                        getattr(record, "responsibilities", None)
                    ),
                    "achievements": ResumeOptimizationReviewService._text(
                        getattr(record, "achievements", None)
                    ),
                })

        return result

    @staticmethod
    def _create_record_suggestion(
        session_id: UUID,
        suggestion_type: str,
        item: dict,
        ai_item: dict,
        allowed_fields: set[str],
    ):
        source_item_id = ai_item.get("source_item_id")
        target_field = ai_item.get("target_field")
        suggested_text = ai_item.get("suggested_text")
        explanation = ai_item.get("explanation")

        if not isinstance(source_item_id, str):
            return None

        if source_item_id != item["id"]:
            return None

        if target_field not in allowed_fields:
            return None

        if not isinstance(suggested_text, str) or not suggested_text.strip():
            return None

        original_text = item.get(target_field, "")

        if not original_text.strip():
            return None

        if suggested_text.strip() == original_text.strip():
            return None

        return ResumeOptimizationSuggestion(
            session_id=session_id,
            suggestion_type=suggestion_type,
            source_item_id=UUID(source_item_id),
            target_field=target_field,
            original_text=original_text,
            suggested_text=suggested_text.strip(),
            explanation=(
                explanation.strip()
                if isinstance(explanation, str)
                else None
            ),
        )

    @staticmethod
    def create_session(
        db: Session,
        resume_id: UUID,
        request: OptimizationSessionCreate,
    ):
        resume = (
            db.query(Resume)
            .filter(Resume.id == resume_id)
            .first()
        )

        if not resume:
            raise LookupError("Resume not found.")

        if not resume.career_profile:
            raise LookupError("Career profile not found.")

        resume_data = ResumeAnalysisService.get_resume_data(
            db,
            resume_id,
        )

        if not resume_data["resume_text"].strip():
            raise ValueError("Resume does not contain sufficient content.")

        selected_records = (
            ResumeOptimizationReviewService._get_selected_records(
                db,
                resume,
            )
        )

        profile = resume.career_profile

        user_prompt = f"""
TARGET ROLE:
{resume.target_role or profile.professional_title or "Not specified"}

CANDIDATE SUMMARY:
{profile.summary or "Not provided"}

UPLOADED RESUME SOURCE TEXT:
{resume_data.get("source_text") or "No uploaded source document"}

SELECTED WORK EXPERIENCE RECORDS:
{selected_records["work_experience"]}

SELECTED PROJECT RECORDS:
{selected_records["project"]}

COMPLETE SELECTED RESUME TEXT:
{resume_data["resume_text"]}

JOB DESCRIPTION:
{request.job_description}

Generate suggestions using only the supplied records.

For every experience and project suggestion:
- Copy the exact source_item_id from the relevant record.
- Use only the supported target_field.
- Do not create a suggestion for a record that was not supplied.
- Do not invent missing information.

Return the required JSON structure.
"""

        try:
            ai_result = AIClient.generate_json(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )

            if not isinstance(ai_result, dict):
                raise ValueError("Invalid optimization response.")

            session = ResumeOptimizationSession(
                resume_id=resume_id,
                job_description=request.job_description,
                target_role=resume.target_role,
                status="pending",
                result_payload=ai_result,
            )

            Repository.create_session(db, session)

            suggestions = []

            # Professional summary
            optimized_summary = ai_result.get("optimized_summary")

            if (
                isinstance(optimized_summary, str)
                and optimized_summary.strip()
                and optimized_summary.strip() != (profile.summary or "").strip()
            ):
                suggestions.append(
                    ResumeOptimizationSuggestion(
                        session_id=session.id,
                        suggestion_type="summary",
                        source_item_id=None,
                        target_field="summary",
                        original_text=profile.summary or "",
                        suggested_text=optimized_summary.strip(),
                        explanation="Improved professional summary aligned with the target role.",
                    )
                )

            uploaded_source_text = resume_data.get("source_text") or ""
            uploaded_suggestions = ai_result.get(
                "uploaded_resume_suggestions",
                [],
            )
            if uploaded_source_text and isinstance(uploaded_suggestions, list):
                for ai_item in uploaded_suggestions:
                    if not isinstance(ai_item, dict):
                        continue

                    original_text = ai_item.get("original_text")
                    suggested_text = ai_item.get("suggested_text")
                    section_name = ai_item.get("section_name")
                    explanation = ai_item.get("explanation")
                    if (
                        not isinstance(original_text, str)
                        or not original_text.strip()
                        or original_text not in uploaded_source_text
                        or not isinstance(suggested_text, str)
                        or not suggested_text.strip()
                        or suggested_text.strip() == original_text.strip()
                    ):
                        continue

                    section_label = (
                        section_name.strip()
                        if isinstance(section_name, str) and section_name.strip()
                        else "Resume"
                    )
                    explanation_text = (
                        explanation.strip()
                        if isinstance(explanation, str) and explanation.strip()
                        else "Improve clarity while preserving the original facts."
                    )
                    suggestions.append(
                        ResumeOptimizationSuggestion(
                            session_id=session.id,
                            suggestion_type="uploaded_resume",
                            source_item_id=None,
                            target_field="source_text",
                            original_text=original_text,
                            suggested_text=suggested_text.strip(),
                            explanation=f"{section_label}: {explanation_text}",
                        )
                    )

            # Experience suggestions
            ai_experience = ai_result.get("experience_suggestions", [])

            if isinstance(ai_experience, list):
                experience_map = {
                    item["id"]: item
                    for item in selected_records["work_experience"]
                }

                for ai_item in ai_experience:
                    if not isinstance(ai_item, dict):
                        continue

                    source_id = ai_item.get("source_item_id")
                    source_item = experience_map.get(source_id)

                    if not source_item:
                        continue

                    suggestion = (
                        ResumeOptimizationReviewService._create_record_suggestion(
                            session_id=session.id,
                            suggestion_type="experience",
                            item=source_item,
                            ai_item=ai_item,
                            allowed_fields=ResumeOptimizationReviewService.EXPERIENCE_FIELDS,
                        )
                    )

                    if suggestion:
                        suggestions.append(suggestion)

            # Project suggestions
            ai_projects = ai_result.get("project_suggestions", [])

            if isinstance(ai_projects, list):
                project_map = {
                    item["id"]: item
                    for item in selected_records["project"]
                }

                for ai_item in ai_projects:
                    if not isinstance(ai_item, dict):
                        continue

                    source_id = ai_item.get("source_item_id")
                    source_item = project_map.get(source_id)

                    if not source_item:
                        continue

                    suggestion = (
                        ResumeOptimizationReviewService._create_record_suggestion(
                            session_id=session.id,
                            suggestion_type="project",
                            item=source_item,
                            ai_item=ai_item,
                            allowed_fields=ResumeOptimizationReviewService.PROJECT_FIELDS,
                        )
                    )

                    if suggestion:
                        suggestions.append(suggestion)

            # Non-applicable recommendations
            recommendation_fields = {
                "keywords_to_consider": "keyword",
                "skill_gap_recommendations": "skill_gap",
                "general_recommendations": "recommendation",
                "factuality_notes": "factuality_note",
            }

            for field, suggestion_type in recommendation_fields.items():
                values = ai_result.get(field, [])

                if not isinstance(values, list):
                    continue

                for value in values:
                    if not isinstance(value, str) or not value.strip():
                        continue

                    suggestions.append(
                        ResumeOptimizationSuggestion(
                            session_id=session.id,
                            suggestion_type=suggestion_type,
                            suggested_text=value.strip(),
                            explanation=None,
                        )
                    )

            Repository.create_suggestions(db, suggestions)
            Repository.commit(db)

            db.refresh(session)

            return {
                "session": session,
                "suggestions": Repository.get_suggestions(
                    db,
                    session.id,
                ),
            }

        except Exception:
            Repository.rollback(db)
            logger.exception(
                "Failed to create resume optimization session: %s",
                resume_id,
            )
            raise

    @staticmethod
    def get_sessions(db: Session, resume_id: UUID):
        if not db.query(Resume).filter(Resume.id == resume_id).first():
            raise LookupError("Resume not found.")

        sessions = Repository.get_sessions_by_resume(db, resume_id)

        return [
            {
                "session": session,
                "suggestions": Repository.get_suggestions(
                    db,
                    session.id,
                ),
            }
            for session in sessions
        ]

    @staticmethod
    def get_session(db: Session, session_id: UUID):
        session = Repository.get_session(db, session_id)

        if not session:
            raise LookupError("Optimization session not found.")

        return {
            "session": session,
            "suggestions": Repository.get_suggestions(
                db,
                session.id,
            ),
        }

    @staticmethod
    def update_decision(
        db: Session,
        suggestion_id: UUID,
        status: str,
    ):
        if status not in {"pending", "accepted", "rejected"}:
            raise ValueError(
                "Status must be pending, accepted or rejected."
            )

        try:
            suggestion = Repository.get_suggestion(
                db,
                suggestion_id,
            )

            if not suggestion:
                raise LookupError(
                    "Optimization suggestion not found."
                )

            # Lock the parent session to prevent concurrent decisions
            # from calculating conflicting session statuses.
            session = Repository.get_session_for_update(
                db,
                suggestion.session_id,
            )

            if not session:
                raise LookupError(
                    "Optimization session not found."
                )

            # Re-fetch the suggestion after acquiring the lock.
            suggestion = Repository.get_suggestion(
                db,
                suggestion_id,
            )

            if not suggestion:
                raise LookupError(
                    "Optimization suggestion not found."
                )

            Repository.update_suggestion_status(
                db,
                suggestion,
                status,
            )

            all_suggestions = Repository.get_suggestions(
                db,
                session.id,
            )

            # Only suggestions that can actually be applied to the
            # resume should determine the optimization session status.
            actionable_types = {
                "summary",
                "experience",
                "project",
            }

            actionable_suggestions = [
                item
                for item in all_suggestions
                if item.suggestion_type in actionable_types
            ]

            statuses = [
                item.status
                for item in actionable_suggestions
            ]

            if not statuses or all(
                value == "pending" for value in statuses
            ):
                session.status = "pending"

            elif all(
                value == "accepted" for value in statuses
            ):
                session.status = "accepted"

            elif all(
                value == "rejected" for value in statuses
            ):
                session.status = "rejected"

            else:
                session.status = "partially_accepted"

            Repository.commit(db)

            db.refresh(suggestion)
            db.refresh(session)

            return {
                "suggestion": suggestion,
                "session_status": session.status,
            }

        except (LookupError, ValueError):
            Repository.rollback(db)
            raise

        except Exception:
            Repository.rollback(db)
            logger.exception(
                "Failed to update optimization decision: %s",
                suggestion_id,
            )
            raise