
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OptimizationSessionCreate(BaseModel):
    job_description: str = Field(
        min_length=100,
        max_length=20000,
    )


class OptimizationDecisionRequest(BaseModel):
    status: Literal["accepted", "rejected"]


class OptimizationSuggestionResponse(BaseModel):
    id: UUID
    session_id: UUID
    suggestion_type: str
    source_item_id: UUID | None = None
    target_field: str | None = None
    original_text: str | None = None
    suggested_text: str
    explanation: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class OptimizationSessionResponse(BaseModel):
    id: UUID
    resume_id: UUID
    target_role: str | None = None
    job_description: str
    status: str
    created_at: datetime
    updated_at: datetime
    suggestions: list[OptimizationSuggestionResponse] = Field(
        default_factory=list
    )

    model_config = ConfigDict(from_attributes=True)


class OptimizationDecisionResponse(BaseModel):
    message: str
    suggestion: OptimizationSuggestionResponse
    session_status: str
