
import uuid

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CareerProfile(Base):
    __tablename__ = "career_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    profile_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )

    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    city: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    professional_title: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    linkedin_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    github_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    leetcode_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    portfolio_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Resume relationship
    resumes = relationship(
        "Resume",
        back_populates="career_profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Education relationship
    educations = relationship(
        "Education",
        back_populates="career_profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Work experience relationship
    work_experiences = relationship(
        "WorkExperience",
        back_populates="career_profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Technical skills relationship
    technical_skills = relationship(
        "TechnicalSkill",
        back_populates="career_profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Projects relationship
    projects = relationship(
        "Project",
        back_populates="career_profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Certifications relationship
    certifications = relationship(
        "Certification",
        back_populates="career_profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Achievements relationship
    achievements = relationship(
        "Achievement",
        back_populates="career_profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
