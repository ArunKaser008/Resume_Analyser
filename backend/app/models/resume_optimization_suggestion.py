import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ResumeOptimizationSuggestion(Base):
    __tablename__ = "resume_optimization_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resume_optimization_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    suggestion_type = Column(String(50), nullable=False)

    # Exact source record for experience/project suggestions.
    source_item_id = Column(UUID(as_uuid=True), nullable=True)

    # summary, description, responsibilities, achievements, etc.
    target_field = Column(String(50), nullable=True)

    original_text = Column(Text, nullable=True)
    suggested_text = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)

    status = Column(String(20), nullable=False, default="pending")

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