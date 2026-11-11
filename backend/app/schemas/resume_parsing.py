from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ParsedContactInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, max_length=150)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=50)
    linkedin_url: str | None = Field(default=None, max_length=2048)
    github_url: str | None = Field(default=None, max_length=2048)
    leetcode_url: str | None = Field(default=None, max_length=2048)
    portfolio_url: str | None = Field(default=None, max_length=2048)


class ParsedEducation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    degree: str | None = Field(default=None, max_length=200)
    institution: str | None = Field(default=None, max_length=200)
    graduation_year: int | None = Field(default=None, ge=1900, le=2200)
    grade: str | None = Field(default=None, max_length=100)


class ParsedTechnicalSkills(BaseModel):
    model_config = ConfigDict(extra="forbid")

    languages: list[str] = Field(default_factory=list, max_length=100)
    frameworks: list[str] = Field(default_factory=list, max_length=100)
    cloud_devops: list[str] = Field(default_factory=list, max_length=100)
    databases: list[str] = Field(default_factory=list, max_length=100)
    tools: list[str] = Field(default_factory=list, max_length=100)


class ParsedExperience(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company: str | None = Field(default=None, max_length=200)
    title: str | None = Field(default=None, max_length=200)
    start_date: str | None = Field(default=None, max_length=100)
    end_date: str | None = Field(default=None, max_length=100)
    bullet_points: list[str] = Field(default_factory=list, max_length=100)


class ParsedProject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=200)
    tech_stack: list[str] = Field(default_factory=list, max_length=100)
    bullet_points: list[str] = Field(default_factory=list, max_length=100)
    live_url: str | None = Field(default=None, max_length=2048)
    code_url: str | None = Field(default=None, max_length=2048)


class ParsedResumeData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contact_info: ParsedContactInfo = Field(default_factory=ParsedContactInfo)
    education: list[ParsedEducation] = Field(default_factory=list, max_length=100)
    technical_skills: ParsedTechnicalSkills = Field(
        default_factory=ParsedTechnicalSkills
    )
    experience: list[ParsedExperience] = Field(default_factory=list, max_length=100)
    projects: list[ParsedProject] = Field(default_factory=list, max_length=100)


class ResumeParseResponse(BaseModel):
    parse_id: UUID
    filename: str
    parsed_data: ParsedResumeData


class ResumeParseUpdate(BaseModel):
    parsed_data: ParsedResumeData
