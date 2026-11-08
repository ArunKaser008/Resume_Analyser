
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume_content_override import ResumeContentOverride


class ResumeContentOverrideRepository:

    @staticmethod
    def get_by_id(db: Session, override_id: UUID):
        return (
            db.query(ResumeContentOverride)
            .filter(ResumeContentOverride.id == override_id)
            .first()
        )

    @staticmethod
    def get_by_target(
        db: Session,
        resume_id: UUID,
        section_type: str,
        source_item_id: UUID | None,
        field_name: str,
    ):
        query = db.query(ResumeContentOverride).filter(
            ResumeContentOverride.resume_id == resume_id,
            ResumeContentOverride.section_type == section_type,
            ResumeContentOverride.field_name == field_name,
        )

        if source_item_id is None:
            query = query.filter(
                ResumeContentOverride.source_item_id.is_(None)
            )
        else:
            query = query.filter(
                ResumeContentOverride.source_item_id == source_item_id
            )

        return query.first()

    @staticmethod
    def get_by_resume(db: Session, resume_id: UUID):
        return (
            db.query(ResumeContentOverride)
            .filter(ResumeContentOverride.resume_id == resume_id)
            .order_by(ResumeContentOverride.created_at.desc())
            .all()
        )

    @staticmethod
    def create(db: Session, override: ResumeContentOverride):
        db.add(override)
        db.flush()
        return override

    @staticmethod
    def delete(db: Session, override: ResumeContentOverride):
        db.delete(override)
        db.flush()

    @staticmethod
    def commit(db: Session):
        db.commit()

    @staticmethod
    def rollback(db: Session):
        db.rollback()
