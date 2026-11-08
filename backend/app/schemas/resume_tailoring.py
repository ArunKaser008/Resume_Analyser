
from pydantic import BaseModel, Field


class ResumeTailoringRequest(BaseModel):
    job_description: str = Field(
        min_length=100,
        max_length=20000,
        description="Complete job description for resume tailoring.",
    )
