import re
from enum import StrEnum
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SeniorityLevel(StrEnum):
    INTERN = "INTERN"
    FRESHER = "FRESHER"
    SENIOR = "SENIOR"


class BulletOptimizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    original_bullet: str = Field(min_length=5, max_length=2000)
    target_role: str = Field(min_length=2, max_length=200)
    seniority_level: SeniorityLevel

    @field_validator("original_bullet", "target_role")
    @classmethod
    def strip_and_reject_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("This field must not be blank.")
        return normalized


class BulletSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    style: Literal["metric", "architecture", "leadership_process"]
    optimized_bullet: str = Field(min_length=10, max_length=1000)
    rationale: str = Field(min_length=10, max_length=1000)

    @model_validator(mode="after")
    def require_xyz_formula(self) -> Self:
        normalized = re.sub(r"\s+", " ", self.optimized_bullet).strip()
        if not re.match(
            r"^Accomplished .+ as measured by .+, by doing .+\.?$",
            normalized,
            flags=re.IGNORECASE,
        ):
            raise ValueError(
                "Each rewrite must follow "
                "'Accomplished [X] as measured by [Y], by doing [Z]'."
            )
        return self


class BulletOptimizeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    suggestions: list[BulletSuggestion] = Field(min_length=3, max_length=3)
    fallback_used: bool = False

    @model_validator(mode="after")
    def require_distinct_suggestion_styles(self) -> Self:
        styles = {suggestion.style for suggestion in self.suggestions}
        if styles != {"metric", "architecture", "leadership_process"}:
            raise ValueError(
                "Suggestions must include metric, architecture, and "
                "leadership_process styles."
            )
        bullets = {
            re.sub(r"\s+", " ", suggestion.optimized_bullet).strip().casefold()
            for suggestion in self.suggestions
        }
        if len(bullets) != 3:
            raise ValueError("The three suggested rewrites must be distinct.")
        return self
