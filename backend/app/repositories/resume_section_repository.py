from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.models.resume_section_item import ResumeSectionItem


class ResumeSectionRepository:

    @staticmethod
    def get_resume(db: Session, resume_id: UUID):
        return db.query(Resume).filter(
            Resume.id == resume_id
        ).first()

    @staticmethod
    def item_belongs_to_profile(
        db: Session,
        model_class,
        item_id: UUID,
        career_profile_id: UUID,
    ) -> bool:
        return (
            db.query(model_class)
            .filter(
                model_class.id == item_id,
                model_class.career_profile_id == career_profile_id,
            )
            .first()
            is not None
        )

    @staticmethod
    def get_sections(db: Session, resume_id: UUID):
        return (
            db.query(ResumeSectionItem)
            .filter(ResumeSectionItem.resume_id == resume_id)
            .order_by(
                ResumeSectionItem.section_type,
                ResumeSectionItem.display_order,
            )
            .all()
        )

    @staticmethod
    def replace_section(
        db: Session,
        resume_id: UUID,
        section_type: str,
        items: list[dict],
    ):
        try:
            db.query(ResumeSectionItem).filter(
                ResumeSectionItem.resume_id == resume_id,
                ResumeSectionItem.section_type == section_type,
            ).delete(synchronize_session=False)

            records = [
                ResumeSectionItem(
                    resume_id=resume_id,
                    section_type=section_type,
                    item_id=item["item_id"],
                    display_order=item["display_order"],
                )
                for item in items
            ]

            db.add_all(records)
            db.commit()

        except Exception:
            db.rollback()
            raise