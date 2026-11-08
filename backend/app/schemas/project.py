
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class ProjectCreate(BaseModel):
    career_profile_id: UUID
    project_name: str = Field(min_length=2, max_length=200)
    role: str | None = Field(default=None, max_length=150)
    technologies: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    responsibilities: str | None = Field(default=None, max_length=5000)
    achievements: str | None = Field(default=None, max_length=5000)
    project_url: HttpUrl | None = None


class ProjectUpdate(BaseModel):
    project_name: str | None = Field(default=None, min_length=2, max_length=200)
    role: str | None = Field(default=None, max_length=150)
    technologies: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    responsibilities: str | None = Field(default=None, max_length=5000)
    achievements: str | None = Field(default=None, max_length=5000)
    project_url: HttpUrl | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    career_profile_id: UUID
    project_name: str
    role: str | None
    technologies: str | None
    description: str | None
    responsibilities: str | None
    achievements: str | None
    project_url: str | None
    created_at: datetime
    updated_at: datetime
