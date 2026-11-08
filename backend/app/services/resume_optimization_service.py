import json
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.services.ai_client import AIClient
from app.services.resume_analysis_service import (
    ResumeAnalysisService,
)


SYSTEM_PROMPT = """
You are an expert resume writer and technical recruiter.

Your task is to optimize resume content for a specific job description.

STRICT RULES:

1. Never invent skills, tools, technologies, employers, job titles,
   qualifications, certifications, dates, or achievements.

2. Use only facts present in the supplied resume.

3. You may improve grammar, clarity, structure, and professional wording.

4. Do not invent numerical metrics, percentages, team sizes, savings,
   performance improvements, or business impact.

5. If a metric is not available, do not create one.

6. Do not claim that the candidate has a missing skill.

7. Suggest missing keywords separately. Do not insert them into
   the candidate's experience unless supported by the resume.

8. Preserve the original meaning of each experience and project.

9. Return valid JSON only. Do not include Markdown or code fences.

10. If the resume does not contain enough information for a suggestion,
    return an empty suggestion rather than making up content.

Return this exact JSON structure:

{
  "optimized_summary": "string",
  "experience_suggestions": [
    {
      "original_text": "string",
      "suggested_text": "string",
      "explanation": "string"
    }
  ],
  "project_suggestions": [
    {
      "original_text": "string",
      "suggested_text": "string",
      "explanation": "string"
    }
  ],
  "keywords_to_consider": ["string"],
  "skill_gap_recommendations": ["string"],
  "general_recommendations": ["string"],
  "factuality_notes": ["string"]
}
"""


class ResumeOptimizationService:

    @staticmethod
    def _get_resume(db: Session, resume_id: UUID):
        resume = (
            db.query(Resume)
            .filter(Resume.id == resume_id)
            .first()
        )

        if not resume:
            raise LookupError("Resume not found")

        return resume

    @staticmethod
    def optimize(
        db: Session,
        resume_id: UUID,
        job_description: str,
    ):
        resume = ResumeOptimizationService._get_resume(
            db,
            resume_id,
        )

        resume_text, resume_skills = (
            ResumeAnalysisService.get_resume_text(
                db=db,
                resume_id=resume_id,
            )
        )

        if not resume_text.strip():
            raise ValueError(
                "Resume does not contain enough content to optimize"
            )

        user_prompt = f"""
TARGET ROLE:
{resume.target_role or "Not specified"}

CURRENT RESUME CONTENT:
{resume_text}

CURRENTLY IDENTIFIED TECHNICAL SKILLS:
{json.dumps(sorted(resume_skills))}

JOB DESCRIPTION:
{job_description}

Analyze the resume against the job description.

Generate a tailored professional summary and improve existing
experience and project statements.

Only rewrite content that is present in the resume.

Return the required JSON structure.
"""

        ai_result = AIClient.generate_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )

        return {
            "resume_id": resume.id,
            "target_role": resume.target_role,
            "optimized_summary": ai_result.get(
                "optimized_summary",
                "",
            ),
            "experience_suggestions": ai_result.get(
                "experience_suggestions",
                [],
            ),
            "project_suggestions": ai_result.get(
                "project_suggestions",
                [],
            ),
            "keywords_to_consider": ai_result.get(
                "keywords_to_consider",
                [],
            ),
            "skill_gap_recommendations": ai_result.get(
                "skill_gap_recommendations",
                [],
            ),
            "general_recommendations": ai_result.get(
                "general_recommendations",
                [],
            ),
            "factuality_notes": ai_result.get(
                "factuality_notes",
                [],
            ),
        }