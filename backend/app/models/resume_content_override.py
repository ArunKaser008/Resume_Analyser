
import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ResumeContentOverride(Base):
    __tablename__ = "resume_content_overrides"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    suggestion_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "resume_optimization_suggestions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
    )

    section_type = Column(
        String(50),
        nullable=False,
    )

    source_item_id = Column(
        UUID(as_uuid=True),
        nullable=True,
    )

    field_name = Column(
        String(50),
        nullable=False,
    )

    content = Column(
        Text,
        nullable=False,
    )

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

    __table_args__ = (
        UniqueConstraint(
            "resume_id",
            "section_type",
            "source_item_id",
            "field_name",
            name="uq_resume_content_override_target",
        ),
        Index(
            "uq_resume_summary_override",
            "resume_id",
            unique=True,
            postgresql_where=text(
                "section_type = 'summary' "
                "AND source_item_id IS NULL "
                "AND field_name = 'summary'"
            ),
        ),
    )
