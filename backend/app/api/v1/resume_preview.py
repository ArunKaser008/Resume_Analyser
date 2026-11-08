import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.resume_template import (
    ResumeTemplateUpdate,
    ResumeTemplateResponse,
)
from app.services.resume_preview_service import ResumePreviewService
from app.services.resume_template_service import ResumeTemplateService
from app.services.resume_pdf_service import ResumePDFService
from app.services.resume_docx_service import ResumeDOCXService


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/resumes",
    tags=["Resume Templates and Preview"],
)


@router.patch(
    "/{resume_id}/template",
    response_model=ResumeTemplateResponse,
)
def update_resume_template(
    resume_id: UUID,
    request: ResumeTemplateUpdate,
    db: Session = Depends(get_db),
):
    try:
        return ResumeTemplateService.update_template(
            db=db,
            resume_id=resume_id,
            template_name=request.template_name,
        )

    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    except Exception:
        logger.exception("Failed to update resume template")
        raise HTTPException(
            status_code=500,
            detail="Unable to update resume template",
        )


@router.get(
    "/{resume_id}/preview",
    response_class=HTMLResponse,
)
def preview_resume(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        html_content = ResumePreviewService.generate_preview(
            db=db,
            resume_id=resume_id,
        )

        return HTMLResponse(content=html_content)

    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    except Exception:
        logger.exception("Failed to generate resume preview")
        raise HTTPException(
            status_code=500,
            detail="Unable to generate resume preview",
        )


@router.get("/{resume_id}/download")
def download_resume_pdf(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        pdf_content = ResumePDFService.generate_pdf(
            db=db,
            resume_id=resume_id,
        )

        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="resume-{resume_id}.pdf"'
                )
            },
        )

    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    except Exception:
        logger.exception("Failed to generate resume PDF")
        raise HTTPException(
            status_code=500,
            detail="Unable to generate resume PDF",
        )


@router.get("/{resume_id}/download/docx")
def download_resume_docx(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        content = ResumeDOCXService.generate_docx(
            db=db,
            resume_id=resume_id,
        )
        return Response(
            content=content,
            media_type=(
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            ),
            headers={
                "Content-Disposition": (
                    f'attachment; filename="resume-{resume_id}.docx"'
                )
            },
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to generate resume DOCX")
        raise HTTPException(
            status_code=500,
            detail="Unable to generate resume DOCX",
        ) from exc