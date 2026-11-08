
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class AchievementCreate(BaseModel):
    career_profile_id: UUID
    title: str = Field(min_length=2, max_length=200)
    category: str | None = Field(default=None, max_length=100)
    issuing_organization: str | None = Field(default=None, max_length=200)
    achievement_date: date | None = None
    description: str | None = None
    credential_url: HttpUrl | None = None


class AchievementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    category: str | None = Field(default=None, max_length=100)
    issuing_organization: str | None = Field(default=None, max_length=200)
    achievement_date: date | None = None
    description: str | None = None
    credential_url: HttpUrl | None = None


class AchievementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    career_profile_id: UUID
    title: str
    category: str | None
    issuing_organization: str | None
    achievement_date: date | None
    description: str | None
    credential_url: str | None
    created_at: datetime
    updated_at: datetime
