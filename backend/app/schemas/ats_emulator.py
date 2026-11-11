from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TargetATS(StrEnum):
    WORKDAY = "WORKDAY"
    GREENHOUSE = "GREENHOUSE"
    LEVER = "LEVER"


class ATSAnalyzeJDRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resume_id: UUID
    job_description: str = Field(max_length=20_000)
    target_ats: TargetATS


class HardSkillMatch(BaseModel):
    skill: str
    status: Literal["matched", "partial", "missing"]
    evidence: list[str] = Field(default_factory=list)
    rationale: str = ""


class SenioritySignals(BaseModel):
    density_per_100_words: float = Field(ge=0, le=100)
    signal_count: int = Field(ge=0)
    signals: list[str] = Field(default_factory=list)
    summary: str


class FormattingFlag(BaseModel):
    line_number: int | None = Field(default=None, ge=1)
    category: str
    severity: Literal["low", "medium", "high"]
    message: str


class ATSScoreBreakdown(BaseModel):
    hard_skills: float = Field(ge=0, le=100)
    soft_skills: float = Field(ge=0, le=100)
    experience_alignment: float = Field(ge=0, le=100)
    formatting: float = Field(ge=0, le=100)


class ATSAnalyzeJDResponse(BaseModel):
    resume_id: UUID
    target_ats: TargetATS
    overall_match_score: float = Field(ge=0, le=100)
    score_breakdown: ATSScoreBreakdown
    hard_skill_matrix: list[HardSkillMatch] = Field(default_factory=list)
    seniority_signals: SenioritySignals
    formatting_risk_score: float = Field(ge=0, le=100)
    formatting_flags: list[FormattingFlag] = Field(default_factory=list)
    raw_parser_output: str
    recruiter_view: str
    parser_warnings: list[str] = Field(default_factory=list)
