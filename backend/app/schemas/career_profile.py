
from datetime import datetime
from uuid import UUID
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl


ProfileType = Literal["student", "fresher", "experienced"]


class CareerProfileCreate(BaseModel):
    profile_type: ProfileType
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=7, max_length=30, pattern=r"^[+0-9().\-\s]+$")
    city: str | None = Field(default=None, max_length=100)
    professional_title: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=5000)
    linkedin_url: HttpUrl | None = None
    github_url: HttpUrl | None = None
    leetcode_url: HttpUrl | None = None
    portfolio_url: HttpUrl | None = None


class CareerProfileUpdate(BaseModel):
    profile_type: ProfileType | None = None
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=7, max_length=30, pattern=r"^[+0-9().\-\s]+$")
    city: str | None = Field(default=None, max_length=100)
    professional_title: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=5000)
    linkedin_url: HttpUrl | None = None
    github_url: HttpUrl | None = None
    leetcode_url: HttpUrl | None = None
    portfolio_url: HttpUrl | None = None


class CareerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_type: str
    full_name: str
    email: str | None
    phone: str | None
    city: str | None
    professional_title: str | None
    summary: str | None
    linkedin_url: str | None
    github_url: str | None
    leetcode_url: str | None
    portfolio_url: str | None
    created_at: datetime
    updated_at: datetime
