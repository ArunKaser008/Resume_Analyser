from uuid import UUID

from pydantic import BaseModel, Field


class ResumeAnalysisRequest(BaseModel):
    job_description: str | None = Field(
        default=None,
        min_length=100,
        max_length=20000,
        description="Optional job description for role-specific analysis",
    )


class ScoreCategory(BaseModel):
    category: str
    weight: float
    score: float
    weighted_score: float
    details: str


class ResumeAnalysisResponse(BaseModel):
    resume_id: UUID

    match_score: float
    score_label: str

    score_breakdown: list[ScoreCategory]

    matched_keywords: list[str]
    missing_keywords: list[str]

    matched_skills: list[str]
    missing_skills: list[str]

    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]

    summary: str