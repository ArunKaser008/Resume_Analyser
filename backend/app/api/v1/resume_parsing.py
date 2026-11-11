import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import enforce_resume_parse_rate_limit
from app.models.resume_parse import ResumeParse
from app.schemas.resume_parsing import (
    ParsedResumeData,
    ResumeParseResponse,
    ResumeParseUpdate,
)
from app.services.ai_client import AIConfigurationError, AIResponseError
from app.services.resume_parsing_service import (
    MAX_PARSE_UPLOAD_BYTES,
    ResumeOCRUnavailableError,
    ResumeParsingService,
)

router = APIRouter(prefix="/resume", tags=["Resume parsing"])
logger = logging.getLogger(__name__)


def _persist_parsed_resume(
    db: Session,
    filename: str,
    raw_text: str,
    parsed_data: ParsedResumeData,
) -> ResumeParse:
    record = ResumeParse(
        filename=filename[:255],
        raw_text=raw_text,
        parsed_data=parsed_data.model_dump(mode="json"),
    )
    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise
    return record


def _update_parsed_resume(
    db: Session,
    parse_id: UUID,
    parsed_data: ParsedResumeData,
) -> ResumeParse:
    record = db.get(ResumeParse, parse_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parsed resume was not found.",
        )

    record.parsed_data = parsed_data.model_dump(mode="json")
    db.commit()
    db.refresh(record)
    return record


@router.post(
    "/parse",
    response_model=ResumeParseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def parse_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: None = Depends(enforce_resume_parse_rate_limit),
) -> ResumeParseResponse:
    filename = Path(file.filename or "").name
    content = await file.read(MAX_PARSE_UPLOAD_BYTES + 1)
    if len(content) > MAX_PARSE_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Resume files cannot exceed 5 MB.",
        )

    try:
        raw_text, parsed_data = await run_in_threadpool(
            ResumeParsingService.parse_resume,
            filename,
            content,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ResumeOCRUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except AIConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except AIResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected resume parsing failure.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to parse the uploaded resume.",
        ) from exc

    record = await run_in_threadpool(
        _persist_parsed_resume,
        db,
        filename,
        raw_text,
        parsed_data,
    )

    return ResumeParseResponse(
        parse_id=record.id,
        filename=record.filename,
        parsed_data=parsed_data,
    )


@router.put(
    "/parse/{parse_id}",
    response_model=ResumeParseResponse,
)
async def update_parsed_resume(
    parse_id: UUID,
    data: ResumeParseUpdate,
    db: Session = Depends(get_db),
) -> ResumeParseResponse:
    record = await run_in_threadpool(
        _update_parsed_resume,
        db,
        parse_id,
        data.parsed_data,
    )
    return ResumeParseResponse(
        parse_id=record.id,
        filename=record.filename,
        parsed_data=ParsedResumeData.model_validate(record.parsed_data),
    )
