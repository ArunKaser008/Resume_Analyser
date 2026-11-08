from typing import Literal

from pydantic import BaseModel


TemplateName = Literal["modern", "professional", "minimal"]


class ResumeTemplateUpdate(BaseModel):
    template_name: TemplateName


class ResumeTemplateResponse(BaseModel):
    resume_id: str
    template_name: TemplateName
    message: str