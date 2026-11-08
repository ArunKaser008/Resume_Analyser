
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ApplySuggestionRequest(BaseModel):
    target_item_id: UUID | None = None

    target_field: Literal[
        "summary",
        "description",
        "responsibilities",
        "achievements",
        "source_text",
    ]

    model_config = ConfigDict(extra="forbid")


class ResumeContentOverrideResponse(BaseModel):
    id: UUID
    resume_id: UUID
    suggestion_id: UUID | None
    section_type: str
    source_item_id: UUID | None
    field_name: str
    content: str
    is_draft: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
