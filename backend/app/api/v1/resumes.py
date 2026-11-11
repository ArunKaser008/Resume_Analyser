from uuid import UUID

from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.services.ai_client import AIConfigurationError, AIResponseError
from app.core.database import get_db
from app.schemas.resume import (
    ResumeCreate,
    ResumeFinalizeChangesRequest,
    ResumeFinalizeChangesResponse,
    ResumeUpdate,
    ResumeResponse,
)
from app.schemas.resume_import import ResumeImportResponse
from app.services import resume_service as service
from app.services.resume_document_service import (
    MAX_UPLOAD_BYTES,
    ResumeDocumentService,
)
from app.services.resume_finalization_service import ResumeFinalizationService


router = APIRouter(prefix="/resumes", tags=["Resumes"])


@router.post(
    "/import",
    response_model=ResumeImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_resume(
    file: UploadFile = File(...),
    profile_type: Literal["student", "fresher", "experienced"] = Form(...),
    full_name: str | None = Form(default=None, max_length=150),
    title: str | None = Form(default=None, max_length=150),
    target_role: str | None = Form(default=None, max_length=200),
    db: Session = Depends(get_db),
):
    content = await file.read(MAX_UPLOAD_BYTES + 1)

    try:
        profile, resume, character_count = (
            ResumeDocumentService.import_resume(
                db=db,
                filename=file.filename or "",
                content=content,
                profile_type=profile_type,
                full_name=full_name,
                title=title,
                target_role=target_role,
            )
        )
        return {
            "career_profile": profile,
            "resume": resume,
            "extracted_character_count": character_count,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post(
    "/import/structured",
    response_model=ResumeImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_resume_structured(
    file: UploadFile = File(...),
    profile_type: Literal["student", "fresher", "experienced"] = Form(...),
    full_name: str | None = Form(default=None, max_length=150),
    title: str | None = Form(default=None, max_length=150),
    target_role: str | None = Form(default=None, max_length=200),
    db: Session = Depends(get_db),
):
    content = await file.read(MAX_UPLOAD_BYTES + 1)

    try:
        profile, resume, character_count = await run_in_threadpool(
            ResumeDocumentService.import_resume_structured,
            db=db,
            filename=file.filename or "",
            content=content,
            profile_type=profile_type,
            full_name=full_name,
            title=title,
            target_role=target_role,
        )
        return {
            "career_profile": profile,
            "resume": resume,
            "extracted_character_count": character_count,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except AIConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resume parsing is not configured. Set GEMINI_API_KEY in the backend environment.",
        ) from exc
    except AIResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to extract structured resume data. Please try again.",
        ) from exc


@router.post(
    "",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_resume(
    data: ResumeCreate,
    db: Session = Depends(get_db),
):
    return service.create_resume(db, data)


@router.get("", response_model=list[ResumeResponse])
def get_resumes(
    career_profile_id: UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return service.get_resumes(db, career_profile_id, skip, limit)


@router.get("/{resume_id}", response_model=ResumeResponse)
def get_resume(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_resume(db, resume_id)


@router.post(
    "/{resume_id}/finalize-changes",
    response_model=ResumeFinalizeChangesResponse,
)
def finalize_resume_changes(
    resume_id: UUID,
    request: ResumeFinalizeChangesRequest,
    db: Session = Depends(get_db),
):
    try:
        resume, saved_copies = ResumeFinalizationService.finalize_changes(
            db=db,
            resume_id=resume_id,
            action=request.action,
        )
        return {
            "resume": resume,
            "saved_copies": saved_copies,
            "maximum_copies": 2,
        }
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.put("/{resume_id}", response_model=ResumeResponse)
def update_resume(
    resume_id: UUID,
    data: ResumeUpdate,
    db: Session = Depends(get_db),
):
    return service.update_resume(db, resume_id, data)


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_resume(db, resume_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)