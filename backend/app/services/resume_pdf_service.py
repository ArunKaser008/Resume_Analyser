from uuid import UUID

from playwright.sync_api import sync_playwright
from sqlalchemy.orm import Session

from app.services.resume_preview_service import ResumePreviewService


class ResumePDFService:

    @staticmethod
    def generate_pdf(db: Session, resume_id: UUID) -> bytes:
        html_content = ResumePreviewService.generate_preview(
            db=db,
            resume_id=resume_id,
        )

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()

            try:
                page = browser.new_page()
                page.set_content(
                    html_content,
                    wait_until="networkidle",
                )

                pdf_bytes = page.pdf(
                    format="A4",
                    print_background=True,
                    prefer_css_page_size=True,
                    display_header_footer=False,
                )

                return pdf_bytes

            finally:
                browser.close()