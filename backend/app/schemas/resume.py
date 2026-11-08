from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ResumeCreate(BaseModel):
    career_profile_id: UUID
    title: str = Field(min_length=2, max_length=150)
    target_role: str | None = Field(default=None, max_length=200)
    template_name: str = Field(default="modern", max_length=50)
    is_primary: bool = False


class ResumeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=150)
    target_role: str | None = Field(default=None, max_length=200)
    template_name: str | None = Field(default=None, max_length=50)
    is_primary: bool | None = None


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    career_profile_id: UUID
    title: str
    target_role: str | None
    template_name: str
    is_primary: bool
    created_at: datetime
    updated_at: datetime