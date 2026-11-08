from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


SectionType = Literal[
    "education",
    "work_experience",
    "technical_skill",
    "project",
    "certification",
    "achievement",
]


class ResumeSectionItemCreate(BaseModel):
    item_id: UUID
    display_order: int = Field(default=0, ge=0)


class ResumeSectionCreate(BaseModel):
    section_type: SectionType
    items: list[ResumeSectionItemCreate] = Field(default_factory=list)


class ResumeSectionsUpdate(BaseModel):
    sections: list[ResumeSectionCreate]


class ResumeSectionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: UUID
    display_order: int


class ResumeSectionResponse(BaseModel):
    section_type: SectionType
    items: list[ResumeSectionItemResponse]


class ResumeSectionsResponse(BaseModel):
    resume_id: UUID
    sections: list[ResumeSectionResponse]