from typing import Literal

from pydantic import BaseModel, Field


class JobDescriptionAnalysisRequest(BaseModel):
    job_description: str = Field(
        min_length=100,
        max_length=20000,
        description="Complete job description text",
    )


class JDRequirement(BaseModel):
    name: str
    category: str
    importance: Literal["mandatory", "preferred"]
    evidence: str = Field(
        description="Short exact or closely paraphrased evidence from the JD"
    )


class JobDescriptionAnalysisResponse(BaseModel):
    job_title: str | None = None
    company_name: str | None = None
    seniority_level: str | None = None

    minimum_experience_years: float | None = None
    maximum_experience_years: float | None = None

    employment_type: str | None = None
    location: str | None = None

    required_skills: list[JDRequirement] = Field(default_factory=list)
    preferred_skills: list[JDRequirement] = Field(default_factory=list)

    responsibilities: list[str] = Field(default_factory=list)
    required_qualifications: list[str] = Field(default_factory=list)
    preferred_qualifications: list[str] = Field(default_factory=list)

    soft_skills: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    domain_keywords: list[str] = Field(default_factory=list)

    summary: str
    extraction_notes: list[str] = Field(default_factory=list)