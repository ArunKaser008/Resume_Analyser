
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EducationCreate(BaseModel):
    career_profile_id: UUID
    institution_name: str = Field(min_length=2, max_length=200)
    degree: str = Field(min_length=2, max_length=150)
    field_of_study: str | None = Field(default=None, max_length=150)
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool = False
    grade: str | None = Field(default=None, max_length=50)
    description: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date")
        if self.is_current and self.end_date:
            raise ValueError("Current education cannot have an end date")
        return self


class EducationUpdate(BaseModel):
    institution_name: str | None = Field(default=None, min_length=2, max_length=200)
    degree: str | None = Field(default=None, min_length=2, max_length=150)
    field_of_study: str | None = Field(default=None, max_length=150)
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool | None = None
    grade: str | None = Field(default=None, max_length=50)
    description: str | None = None


class EducationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    career_profile_id: UUID
    institution_name: str
    degree: str
    field_of_study: str | None
    start_date: date | None
    end_date: date | None
    is_current: bool
    grade: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime
