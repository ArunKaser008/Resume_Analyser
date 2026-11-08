
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WorkExperienceCreate(BaseModel):
    career_profile_id: UUID
    company_name: str = Field(min_length=2, max_length=200)
    job_title: str = Field(min_length=2, max_length=200)
    employment_type: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=150)
    start_date: date
    end_date: date | None = None
    is_current: bool = False
    description: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date")
        if self.is_current and self.end_date:
            raise ValueError("Current employment cannot have an end date")
        return self


class WorkExperienceUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=2, max_length=200)
    job_title: str | None = Field(default=None, min_length=2, max_length=200)
    employment_type: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=150)
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool | None = None
    description: str | None = Field(default=None, max_length=5000)


class WorkExperienceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    career_profile_id: UUID
    company_name: str
    job_title: str
    employment_type: str | None
    location: str | None
    start_date: date
    end_date: date | None
    is_current: bool
    description: str | None
    created_at: datetime
    updated_at: datetime
