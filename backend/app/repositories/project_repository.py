
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


def create(db: Session, data: ProjectCreate) -> Project:
    project_data = data.model_dump(mode="json")
    project = Project(**project_data)
    db.add(project)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(project)
    return project


def get_by_id(db: Session, project_id: UUID) -> Project | None:
    return db.get(Project, project_id)


def get_all(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Project]:
    statement = select(Project).order_by(Project.created_at.desc())

    if career_profile_id:
        statement = statement.where(
            Project.career_profile_id == career_profile_id
        )

    statement = statement.offset(skip).limit(limit)
    return list(db.scalars(statement).all())


def update(
    db: Session,
    project: Project,
    data: ProjectUpdate,
) -> Project:
    project_data = data.model_dump(exclude_unset=True, mode="json")

    for field, value in project_data.items():
        setattr(project, field, value)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(project)
    return project


def delete(db: Session, project: Project) -> None:
    db.delete(project)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
