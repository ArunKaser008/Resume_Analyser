from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SkillMatch(BaseModel):
    skill_name: str
    category: str
    importance: Literal["mandatory", "preferred"]
    status: Literal["matched", "partial", "missing"]
    match_percentage: float
    evidence: list[str] = Field(default_factory=list)


class EvidenceMatch(BaseModel):
    requirement: str
    status: Literal[
        "matched",
        "partial",
        "missing",
        "not_applicable",
    ]
    match_percentage: float | None = None
    evidence: list[str] = Field(default_factory=list)


class MatchCategoryScore(BaseModel):
    category: str
    weight: float
    score: float
    weighted_score: float
    details: str


class CandidateJDMatchResponse(BaseModel):
    resume_id: UUID
    job_title: str | None = None
    target_role: str | None = None

    overall_match_score: float
    match_label: str

    mandatory_skill_match_percentage: float | None = None
    preferred_skill_match_percentage: float | None = None

    matched_skills: list[SkillMatch]
    partially_matched_skills: list[SkillMatch]
    missing_skills: list[SkillMatch]

    experience_alignment: EvidenceMatch
    project_alignment: EvidenceMatch
    qualification_alignment: EvidenceMatch

    score_breakdown: list[MatchCategoryScore]

    strengths: list[str]
    improvement_opportunities: list[str]
    summary: str