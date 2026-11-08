
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class CertificationCreate(BaseModel):
    career_profile_id: UUID
    certification_name: str = Field(min_length=2, max_length=200)
    issuing_organization: str = Field(min_length=2, max_length=200)
    credential_id: str | None = Field(default=None, max_length=150)
    credential_url: HttpUrl | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    does_not_expire: bool = False

    @model_validator(mode="after")
    def validate_dates(self):
        if self.issue_date and self.expiry_date:
            if self.expiry_date < self.issue_date:
                raise ValueError("Expiry date cannot be before issue date")

        if self.does_not_expire and self.expiry_date:
            raise ValueError("Non-expiring certification cannot have an expiry date")

        return self


class CertificationUpdate(BaseModel):
    certification_name: str | None = Field(default=None, min_length=2, max_length=200)
    issuing_organization: str | None = Field(default=None, min_length=2, max_length=200)
    credential_id: str | None = Field(default=None, max_length=150)
    credential_url: HttpUrl | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    does_not_expire: bool | None = None


class CertificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    career_profile_id: UUID
    certification_name: str
    issuing_organization: str
    credential_id: str | None
    credential_url: str | None
    issue_date: date | None
    expiry_date: date | None
    does_not_expire: bool
    created_at: datetime
    updated_at: datetime
