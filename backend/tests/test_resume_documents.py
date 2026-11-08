from io import BytesIO
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from docx import Document

from app.services.resume_document_service import ResumeDocumentService
from app.services.resume_docx_service import ResumeDOCXService
from app.services.resume_content_override_service import (
    ResumeContentOverrideService,
)


class ResumeDocumentServiceTests(unittest.TestCase):
    def test_extracts_docx_paragraphs_and_tables(self):
        source = Document()
        source.add_paragraph("Avery Example")
        table = source.add_table(rows=1, cols=2)
        table.cell(0, 0).text = "Python"
        table.cell(0, 1).text = "PostgreSQL"
        output = BytesIO()
        source.save(output)

        text = ResumeDocumentService.extract_text(
            "resume.docx",
            output.getvalue(),
        )

        self.assertIn("Avery Example", text)
        self.assertIn("Python | PostgreSQL", text)

    def test_extracts_utf8_text(self):
        text = ResumeDocumentService.extract_text(
            "resume.txt",
            b"Avery Example\nSoftware Engineer",
        )

        self.assertEqual(text, "Avery Example\nSoftware Engineer")

    def test_import_persists_uploaded_source_with_selected_candidate_type(self):
        source = Document()
        source.add_paragraph("Avery Example")
        output = BytesIO()
        source.save(output)
        db = Mock()
        profile = None

        def flush():
            nonlocal profile
            profile = db.add.call_args_list[0].args[0]
            profile.id = uuid4()

        db.flush.side_effect = flush

        imported_profile, resume, character_count = (
            ResumeDocumentService.import_resume(
                db=db,
                filename="avery-resume.docx",
                content=output.getvalue(),
                profile_type="fresher",
                full_name="Avery Example",
                title=None,
                target_role="Junior Engineer",
            )
        )

        self.assertEqual(imported_profile.profile_type, "fresher")
        self.assertEqual(resume.career_profile_id, imported_profile.id)
        self.assertEqual(resume.source_filename, "avery-resume.docx")
        self.assertEqual(resume.source_text, "Avery Example")
        self.assertEqual(character_count, len("Avery Example"))
        db.commit.assert_called_once()

    def test_import_infers_name_from_resume_when_not_provided(self):
        source = Document()
        source.add_paragraph("Avery Example")
        output = BytesIO()
        source.save(output)
        db = Mock()
        db.flush.side_effect = lambda: setattr(db.add.call_args_list[0].args[0], "id", uuid4())

        profile, _, _ = ResumeDocumentService.import_resume(
            db=db,
            filename="candidate.docx",
            content=output.getvalue(),
            profile_type="experienced",
            full_name=None,
            title=None,
            target_role=None,
        )

        self.assertEqual(profile.full_name, "Avery Example")

    def test_student_import_does_not_store_a_target_role(self):
        source = Document()
        source.add_paragraph("Avery Example")
        output = BytesIO()
        source.save(output)
        db = Mock()
        db.flush.side_effect = lambda: setattr(db.add.call_args_list[0].args[0], "id", uuid4())

        profile, resume, _ = ResumeDocumentService.import_resume(
            db=db,
            filename="avery-resume.docx",
            content=output.getvalue(),
            profile_type="student",
            full_name="Avery Example",
            title=None,
            target_role="Software Engineer",
        )

        self.assertEqual(profile.profile_type, "student")
        self.assertIsNone(profile.professional_title)
        self.assertIsNone(resume.target_role)

    def test_rejects_unsupported_file_types(self):
        with self.assertRaisesRegex(ValueError, "PDF, DOCX, or TXT"):
            ResumeDocumentService.extract_text("resume.png", b"not a resume")

    def test_applies_uploaded_section_suggestion_without_replacing_other_content(self):
        updated = ResumeContentOverrideService._replace_uploaded_source_text(
            "Experience\nBuilt services.\nEducation\nBSc",
            "Built services.",
            "Designed reliable services.",
        )

        self.assertEqual(
            updated,
            "Experience\nDesigned reliable services.\nEducation\nBSc",
        )

    def test_rejects_stale_uploaded_section_suggestion(self):
        with self.assertRaisesRegex(ValueError, "Run optimization again"):
            ResumeContentOverrideService._replace_uploaded_source_text(
                "Latest resume text",
                "Old resume text",
                "Suggested text",
            )

    def test_rejects_empty_or_unreadable_documents(self):
        with self.assertRaisesRegex(ValueError, "empty"):
            ResumeDocumentService.extract_text("resume.txt", b"")
        with self.assertRaisesRegex(ValueError, "UTF-8"):
            ResumeDocumentService.extract_text("resume.txt", b"\xff")

    def test_docx_export_contains_preview_content_and_preserves_imported_lines(self):
        with patch(
            "app.services.resume_docx_service.ResumePreviewService.generate_preview",
            return_value=(
                "<html><head><style>body{color:red}</style></head>"
                "<body><h1>Avery Example</h1><h2>Experience</h2>"
                "<p>Built reliable software.</p>"
                "<p class='description source-content'>Education\nBachelor's"
                " degree</p></body></html>"
            ),
        ):
            content = ResumeDOCXService.generate_docx(None, None)

        exported = Document(BytesIO(content))
        paragraphs = [paragraph.text for paragraph in exported.paragraphs]
        self.assertEqual(
            paragraphs,
            [
                "Avery Example",
                "Experience",
                "Built reliable software.",
                "Education",
                "Bachelor's degree",
            ],
        )


if __name__ == "__main__":
    unittest.main()
