from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.schemas.resume_template import TemplateName


class CustomResumeEntry(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    subtitle: str | None = Field(default=None, max_length=200)
    date: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=150)
    url: HttpUrl | None = None
    description: str | None = Field(default=None, max_length=5000)


class CustomResumeSection(BaseModel):
    id: UUID
    section_type: Literal[
        "language",
        "volunteer",
        "publication",
        "course",
        "interest",
        "reference",
        "custom",
    ]
    title: str = Field(min_length=2, max_length=60)
    entries: list[CustomResumeEntry] = Field(default_factory=list, max_length=50)


def ensure_unique_custom_section_ids(sections):
    ids = [section.id for section in sections]
    if len(ids) != len(set(ids)):
        raise ValueError("Custom section IDs must be unique.")
    return sections


class ResumeDesignSettings(BaseModel):
    layout: Literal["single-column", "two-column"] = "single-column"
    font_family: Literal[
        "Arial",
        "Garamond",
        "Georgia",
        "Helvetica",
        "Inter",
        "Merriweather",
        "Roboto",
    ] = "Arial"
    font_size: float = Field(default=10, ge=9.5, le=10.5)
    spacing: Literal["compact", "comfortable", "spacious"] = "comfortable"
    accent_color: str = Field(default="#00A7A2", pattern=r"^#[0-9A-Fa-f]{6}$")
    page_size: Literal["A4", "Letter"] = "A4"


ResumeSectionOrder = list[
    Literal[
        "education",
        "work_experience",
        "technical_skill",
        "project",
        "certification",
        "achievement",
    ]
]


class ResumeCreate(BaseModel):
    career_profile_id: UUID | None = None
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    profile_type: Literal["student", "fresher", "experienced"] = "experienced"
    title: str = Field(min_length=2, max_length=150)
    target_role: str | None = Field(default=None, max_length=200)
    template_name: TemplateName = "modern"
    is_primary: bool = False
    custom_sections: list[CustomResumeSection] = Field(default_factory=list, max_length=12)
    design_settings: ResumeDesignSettings = Field(default_factory=ResumeDesignSettings)
    section_order: ResumeSectionOrder = Field(default_factory=list, max_length=6)

    @field_validator("custom_sections")
    @classmethod
    def unique_custom_section_ids(cls, sections):
        return ensure_unique_custom_section_ids(sections)

    @field_validator("section_order")
    @classmethod
    def unique_section_order(cls, section_order):
        if len(section_order) != len(set(section_order)):
            raise ValueError("Section order cannot contain duplicates.")
        return section_order


class ResumeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=150)
    target_role: str | None = Field(default=None, max_length=200)
    template_name: TemplateName | None = None
    is_primary: bool | None = None
    custom_sections: list[CustomResumeSection] = Field(default_factory=list, max_length=12)
    design_settings: ResumeDesignSettings = Field(default_factory=ResumeDesignSettings)
    section_order: ResumeSectionOrder = Field(default_factory=list, max_length=6)

    @field_validator("custom_sections")
    @classmethod
    def unique_custom_section_ids(cls, sections):
        return ensure_unique_custom_section_ids(sections)

    @field_validator("section_order")
    @classmethod
    def unique_section_order(cls, section_order):
        if len(section_order) != len(set(section_order)):
            raise ValueError("Section order cannot contain duplicates.")
        return section_order


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    career_profile_id: UUID
    parent_resume_id: UUID | None = None
    title: str
    target_role: str | None
    template_name: str
    is_primary: bool
    source_filename: str | None = None
    custom_sections: list[CustomResumeSection] = Field(default_factory=list)
    design_settings: ResumeDesignSettings = Field(default_factory=ResumeDesignSettings)
    section_order: ResumeSectionOrder = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @field_validator("design_settings", mode="before")
    @classmethod
    def normalize_legacy_design_settings(cls, value):
        if not isinstance(value, dict):
            return value

        settings = dict(value)
        if settings.get("font_family") not in {
            "Arial",
            "Garamond",
            "Georgia",
            "Helvetica",
            "Inter",
            "Merriweather",
            "Roboto",
        }:
            settings["font_family"] = "Arial"

        try:
            font_size = float(settings.get("font_size", 10))
        except (TypeError, ValueError):
            font_size = 10
        if not 9.5 <= font_size <= 10.5:
            settings["font_size"] = 10

        return settings


class ResumeFinalizeChangesRequest(BaseModel):
    action: Literal["update_existing", "save_copy"]


class ResumeFinalizeChangesResponse(BaseModel):
    resume: ResumeResponse
    saved_copies: int
    maximum_copies: int = 2