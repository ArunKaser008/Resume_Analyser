from uuid import UUID

from pydantic import BaseModel, Field


class ResumeAnalysisRequest(BaseModel):
    job_description: str = Field(
        min_length=100,
        max_length=20000,
        description="Full job description",
    )


class ResumeAnalysisResponse(BaseModel):
    resume_id: UUID
    match_score: float
    matched_keywords: list[str]
    missing_keywords: list[str]
    matched_skills: list[str]
    missing_skills: list[str]
    recommendations: list[str]
    summary: str