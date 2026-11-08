from io import BytesIO
from pathlib import Path
import re

from docx import Document
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.models.career_profile import CareerProfile
from app.models.resume import Resume


MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_EXTRACTED_CHARACTERS = 100_000
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}


class ResumeDocumentService:
    @staticmethod
    def extract_text(filename: str, content: bytes) -> str:
        extension = Path(filename).suffix.lower()
        if extension not in SUPPORTED_EXTENSIONS:
            raise ValueError("Upload a PDF, DOCX, or TXT resume.")
        if not content:
            raise ValueError("The uploaded file is empty.")
        if len(content) > MAX_UPLOAD_BYTES:
            raise ValueError("Resume files cannot exceed 10 MB.")

        try:
            if extension == ".pdf":
                reader = PdfReader(BytesIO(content))
                if reader.is_encrypted:
                    raise ValueError("Password-protected PDF files are not supported.")
                text = "\n".join(page.extract_text() or "" for page in reader.pages)
            elif extension == ".docx":
                document = Document(BytesIO(content))
                paragraphs = [paragraph.text for paragraph in document.paragraphs]
                table_rows = [
                    " | ".join(cell.text for cell in row.cells)
                    for table in document.tables
                    for row in table.rows
                ]
                text = "\n".join([*paragraphs, *table_rows])
            else:
                text = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValueError("Text resumes must be encoded as UTF-8.") from exc
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError("The uploaded document could not be read.") from exc

        text = re.sub(r"\x00", "", text).strip()
        if not text:
            raise ValueError(
                "No selectable text was found. Scanned image-only resumes are not supported."
            )
        if len(text) > MAX_EXTRACTED_CHARACTERS:
            raise ValueError("Extracted resume text exceeds the 100,000 character limit.")
        return text

    @staticmethod
    def import_resume(
        db: Session,
        *,
        filename: str,
        content: bytes,
        profile_type: str,
        full_name: str | None,
        title: str | None,
        target_role: str | None,
    ) -> tuple[CareerProfile, Resume, int]:
        if profile_type not in {"fresher", "experienced"}:
            raise ValueError("Profile type must be fresher or experienced.")

        source_text = ResumeDocumentService.extract_text(filename, content)
        cleaned_name = (full_name or "").strip() or ResumeDocumentService._infer_name(
            source_text,
            filename,
        )
        resume_title = (title or Path(filename).stem).strip()[:150]
        if len(resume_title) < 2:
            raise ValueError("Resume title must contain at least two characters.")

        profile = CareerProfile(
            profile_type=profile_type,
            full_name=cleaned_name[:150],
            professional_title=target_role.strip()[:200] if target_role else None,
        )

        try:
            db.add(profile)
            db.flush()
            resume = Resume(
                career_profile_id=profile.id,
                title=resume_title,
                target_role=target_role.strip()[:200] if target_role else None,
                source_filename=Path(filename).name[:255],
                source_text=source_text,
                is_primary=False,
            )
            db.add(resume)
            db.commit()
            db.refresh(profile)
            db.refresh(resume)
            return profile, resume, len(source_text)
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def _infer_name(source_text: str, filename: str) -> str:
        for line in source_text.splitlines():
            candidate = line.strip()
            normalized = candidate.replace(" ", "").replace(".", "").replace("-", "").replace("'", "")
            if (
                2 <= len(candidate) <= 150
                and normalized.isalpha()
                and len(candidate.split()) <= 6
            ):
                return candidate

        filename_name = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
        return filename_name[:150] if len(filename_name) >= 2 else "Resume candidate"
