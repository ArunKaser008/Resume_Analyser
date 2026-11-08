from uuid import UUID

from pydantic import BaseModel, Field


class ResumeOptimizationRequest(BaseModel):
    job_description: str = Field(
        min_length=100,
        max_length=20000,
    )


class BulletSuggestion(BaseModel):
    original_text: str
    suggested_text: str
    explanation: str


class ResumeOptimizationResponse(BaseModel):
    resume_id: UUID
    target_role: str | None
    optimized_summary: str
    experience_suggestions: list[BulletSuggestion]
    project_suggestions: list[BulletSuggestion]
    keywords_to_consider: list[str]
    skill_gap_recommendations: list[str]
    general_recommendations: list[str]
    factuality_notes: list[str]