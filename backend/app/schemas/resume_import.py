from pydantic import BaseModel

from app.schemas.career_profile import CareerProfileResponse
from app.schemas.resume import ResumeResponse


class ResumeImportResponse(BaseModel):
    career_profile: CareerProfileResponse
    resume: ResumeResponse
    extracted_character_count: int
