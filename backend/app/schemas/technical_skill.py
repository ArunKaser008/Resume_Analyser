
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TechnicalSkillCreate(BaseModel):
    career_profile_id: UUID
    skill_name: str = Field(min_length=1, max_length=150)
    category: str | None = Field(default=None, max_length=100)
    proficiency_level: str | None = Field(default=None, max_length=50)
    years_of_experience: int | None = Field(default=None, ge=0, le=60)


class TechnicalSkillUpdate(BaseModel):
    skill_name: str | None = Field(default=None, min_length=1, max_length=150)
    category: str | None = Field(default=None, max_length=100)
    proficiency_level: str | None = Field(default=None, max_length=50)
    years_of_experience: int | None = Field(default=None, ge=0, le=60)


class TechnicalSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    career_profile_id: UUID
    skill_name: str
    category: str | None
    proficiency_level: str | None
    years_of_experience: int | None
    created_at: datetime
    updated_at: datetime
