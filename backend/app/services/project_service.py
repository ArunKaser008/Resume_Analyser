
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.career_profile import CareerProfile
from app.models.project import Project
from app.repositories import project_repository as repository
from app.schemas.project import ProjectCreate, ProjectUpdate


def create_project(db: Session, data: ProjectCreate) -> Project:
    profile = db.get(CareerProfile, data.career_profile_id)

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return repository.create(db, data)


def get_project(db: Session, project_id: UUID) -> Project:
    project = repository.get_by_id(db, project_id)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


def get_projects(
    db: Session,
    career_profile_id: UUID | None = None,
    skip: int = 0,
    limit: int = 20,
):
    if career_profile_id and db.get(CareerProfile, career_profile_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    return repository.get_all(db, career_profile_id, skip, limit)


def update_project(
    db: Session,
    project_id: UUID,
    data: ProjectUpdate,
) -> Project:
    project = get_project(db, project_id)

    if "project_name" in data.model_fields_set and data.project_name is None:
        raise HTTPException(
            status_code=422,
            detail="Project name cannot be null",
        )

    return repository.update(db, project, data)


def delete_project(db: Session, project_id: UUID) -> None:
    project = get_project(db, project_id)
    repository.delete(db, project)
