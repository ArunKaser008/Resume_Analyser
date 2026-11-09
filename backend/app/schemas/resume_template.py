from typing import Literal, get_args

from pydantic import BaseModel


TemplateName = Literal[
    "modern",
    "professional",
    "minimal",
    "classic-clear",
    "atlantic-blue",
    "mercury-flow",
    "executive",
    "elegant",
    "charcoal",
    "coral",
    "emerald",
    "indigo",
]
AVAILABLE_TEMPLATES = frozenset(get_args(TemplateName))


class ResumeTemplateUpdate(BaseModel):
    template_name: TemplateName


class ResumeTemplateResponse(BaseModel):
    resume_id: str
    template_name: TemplateName
    message: str