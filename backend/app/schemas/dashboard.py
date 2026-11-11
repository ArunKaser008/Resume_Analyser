from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class HighlightFlag(StrEnum):
    ATS_RISK = "ATS_RISK"
    WEAK_PHRASING = "WEAK_PHRASING"
    STRONG_METRIC = "STRONG_METRIC"


class TierType(StrEnum):
    MAANG_PRODUCT = "MAANG_PRODUCT"
    SERVICED_MNC = "SERVICED_MNC"
    SERIES_B_STARTUP = "SERIES_B_STARTUP"


class DashboardScoreBreakdown(BaseModel):
    hard_skills: float = Field(ge=0, le=100)
    formatting: float = Field(ge=0, le=100)
    proof_of_work: float = Field(ge=0, le=100)
    leadership: float = Field(ge=0, le=100)


class PriorityFix(BaseModel):
    id: str
    title: str
    description: str
    estimated_impact: str
    line_number: int = Field(ge=1)


class AnnotatedSection(BaseModel):
    line_number: int = Field(ge=1)
    text: str
    highlight: HighlightFlag | None = None


class DashboardResponse(BaseModel):
    analysis_id: UUID
    resume_id: UUID
    overall_score: float = Field(ge=0, le=100)
    ats_grade: Literal["A+", "A", "B", "C", "F"]
    target_role: str
    score_breakdown: DashboardScoreBreakdown
    top_priority_fixes: list[PriorityFix] = Field(max_length=3)
    annotated_sections: list[AnnotatedSection]


class TierSimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resume_id: UUID
    tier_type: TierType


class TierCheck(BaseModel):
    name: str
    passed: bool
    score: float = Field(ge=0, le=100)
    detail: str


class TierSimulationResponse(BaseModel):
    resume_id: UUID
    tier_type: TierType
    overall_score: float = Field(ge=0, le=100)
    score_breakdown: DashboardScoreBreakdown
    checks: list[TierCheck]


class InterviewPrepRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resume_id: UUID
    target_jd: str | None = Field(default=None, max_length=20_000)


class TechnicalProbe(BaseModel):
    question: str = Field(min_length=1, max_length=1200)
    resume_claim: str = Field(min_length=1, max_length=1000)
    evaluation_focus: str = Field(min_length=1, max_length=500)


class GapTrap(BaseModel):
    weak_area: str = Field(min_length=1, max_length=500)
    interviewer_question: str = Field(min_length=1, max_length=1000)
    suggested_talking_points: list[str] = Field(min_length=1, max_length=5)


class InterviewPrepResponse(BaseModel):
    resume_id: UUID
    technical_probes: list[TechnicalProbe] = Field(min_length=3, max_length=3)
    gap_traps: list[GapTrap] = Field(min_length=2, max_length=2)


class CopilotChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resume_id: UUID
    message: str = Field(min_length=1, max_length=4000)
    context_section_id: str | None = Field(default=None, max_length=200)


class ResumePatch(BaseModel):
    operation: Literal["replace", "insert"]
    section_id: str | None = None
    original_text: str
    suggested_text: str = Field(min_length=1, max_length=2000)
    rationale: str


class CopilotChatResponse(BaseModel):
    resume_id: UUID
    message: str = Field(min_length=1, max_length=4000)
    patches: list[ResumePatch] = Field(default_factory=list, max_length=5)
