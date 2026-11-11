from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.career_profile import CareerProfileResponse
from app.schemas.resume import ResumeResponse


class ResumeImportObject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="before")
    @classmethod
    def normalize_text_fields(cls, value):
        if not isinstance(value, dict):
            return {}

        normalized = dict(value)
        limits = {
            "full_name": 150,
            "email": 255,
            "phone": 30,
            "city": 100,
            "professional_title": 200,
            "summary": 350,
            "linkedin_url": 500,
            "github_url": 500,
            "leetcode_url": 500,
            "portfolio_url": 500,
            "institution_name": 200,
            "degree": 150,
            "field_of_study": 150,
            "start_date": 50,
            "end_date": 50,
            "grade": 50,
            "description": 5000,
            "company_name": 200,
            "job_title": 200,
            "employment_type": 50,
            "location": 150,
            "skill_name": 150,
            "category": 100,
            "proficiency_level": 50,
            "project_name": 200,
            "role": 150,
            "technologies": 500,
            "responsibilities": 5000,
            "achievements": 5000,
            "project_url": 500,
            "certification_name": 200,
            "issuing_organization": 200,
            "credential_id": 150,
            "credential_url": 500,
            "issue_date": 50,
            "expiry_date": 50,
            "title": 200,
            "achievement_date": 50,
        }
        for field, limit in limits.items():
            field_value = normalized.get(field)
            if isinstance(field_value, str):
                normalized[field] = field_value.strip()[:limit] or None
        return normalized


class ResumeImportPersonalInfo(ResumeImportObject):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    professional_title: str | None = None
    summary: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    leetcode_url: str | None = None
    portfolio_url: str | None = None


class ResumeImportEducation(ResumeImportObject):
    institution_name: str | None = None
    degree: str | None = None
    field_of_study: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current: bool = False
    grade: str | None = None
    description: str | None = None

    @field_validator("is_current", mode="before")
    @classmethod
    def normalize_current_flag(cls, value):
        if isinstance(value, str):
            return value.strip().lower() in {"true", "yes", "current", "present"}
        return value if isinstance(value, bool) else False


class ResumeImportExperience(ResumeImportObject):
    company_name: str | None = None
    job_title: str | None = None
    employment_type: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current: bool = False
    description: str | None = None

    @field_validator("is_current", mode="before")
    @classmethod
    def normalize_current_flag(cls, value):
        if isinstance(value, str):
            return value.strip().lower() in {"true", "yes", "current", "present"}
        return value if isinstance(value, bool) else False


class ResumeImportSkill(ResumeImportObject):
    skill_name: str | None = None
    category: str | None = None
    proficiency_level: str | None = None
    years_of_experience: int | None = Field(default=None, ge=0, le=60)

    @field_validator("years_of_experience", mode="before")
    @classmethod
    def normalize_years(cls, value):
        if value is None:
            return None
        try:
            years = int(value)
        except (TypeError, ValueError):
            return None
        return years if 0 <= years <= 60 else None


class ResumeImportProject(ResumeImportObject):
    project_name: str | None = None
    role: str | None = None
    technologies: str | None = None
    description: str | None = None
    responsibilities: str | None = None
    achievements: str | None = None
    project_url: str | None = None


class ResumeImportCertification(ResumeImportObject):
    certification_name: str | None = None
    issuing_organization: str | None = None
    credential_id: str | None = None
    credential_url: str | None = None
    issue_date: str | None = None
    expiry_date: str | None = None
    does_not_expire: bool = False

    @field_validator("does_not_expire", mode="before")
    @classmethod
    def normalize_expiry_flag(cls, value):
        if isinstance(value, str):
            return value.strip().lower() in {"true", "yes", "no expiry", "never"}
        return value if isinstance(value, bool) else False


class ResumeImportAchievement(ResumeImportObject):
    title: str | None = None
    category: str | None = None
    issuing_organization: str | None = None
    achievement_date: str | None = None
    credential_url: str | None = None
    description: str | None = None


class ResumeImportData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    personal_info: ResumeImportPersonalInfo = Field(
        default_factory=ResumeImportPersonalInfo,
    )
    education: list[ResumeImportEducation] = Field(default_factory=list)
    work_experience: list[ResumeImportExperience] = Field(default_factory=list)
    skills: list[ResumeImportSkill] = Field(default_factory=list)
    projects: list[ResumeImportProject] = Field(default_factory=list)
    certifications: list[ResumeImportCertification] = Field(default_factory=list)
    achievements: list[ResumeImportAchievement] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_collections(cls, value):
        if not isinstance(value, dict):
            return {}

        normalized = dict(value)
        if not isinstance(normalized.get("personal_info"), dict):
            normalized["personal_info"] = {}

        for field in (
            "education",
            "work_experience",
            "skills",
            "projects",
            "certifications",
            "achievements",
        ):
            items = normalized.get(field)
            if not isinstance(items, list):
                normalized[field] = []
                continue
            normalized[field] = [
                {"skill_name": item} if field == "skills" and isinstance(item, str)
                else item
                for item in items
                if isinstance(item, dict) or (field == "skills" and isinstance(item, str))
            ]
        return normalized


class ResumeImportResponse(BaseModel):
    career_profile: CareerProfileResponse
    resume: ResumeResponse
    extracted_character_count: int
