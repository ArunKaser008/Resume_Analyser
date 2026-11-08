
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.certification import Certification
from app.schemas.certification import CertificationCreate, CertificationUpdate


def create(db: Session, data: CertificationCreate) -> Certification:
    certification = Certification(**data.model_dump(mode="json"))
    db.add(certification)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(certification)
    return certification


def get_by_id(db: Session, certification_id: UUID) -> Certification | None:
    return db.get(Certification, certification_id)


def get_all(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Certification]:
    statement = select(Certification).order_by(
        Certification.issue_date.desc().nullslast()
    )

    if career_profile_id:
        statement = statement.where(
            Certification.career_profile_id == career_profile_id
        )

    statement = statement.offset(skip).limit(limit)
    return list(db.scalars(statement).all())


def update(
    db: Session,
    certification: Certification,
    data: CertificationUpdate,
) -> Certification:
    values = data.model_dump(exclude_unset=True, mode="json")

    for field, value in values.items():
        setattr(certification, field, value)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(certification)
    return certification


def delete(db: Session, certification: Certification) -> None:
    db.delete(certification)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
