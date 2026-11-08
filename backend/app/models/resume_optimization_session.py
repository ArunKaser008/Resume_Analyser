
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ResumeOptimizationSession(Base):
    __tablename__ = "resume_optimization_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    job_description = Column(Text, nullable=False)
    target_role = Column(String(255), nullable=True)
    status = Column(String(30), nullable=False, default="pending")

    result_payload = Column(JSON, nullable=False, default=dict)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
