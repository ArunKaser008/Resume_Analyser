from io import BytesIO
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from docx import Document

from app.models.achievement import Achievement
from app.models.education import Education
from app.models.project import Project
from app.models.resume_section_item import ResumeSectionItem
from app.models.technical_skill import TechnicalSkill
from app.models.work_experience import WorkExperience
from app.schemas.resume_import import ResumeImportData
from app.services.resume_document_service import ResumeDocumentService
from app.services.resume_docx_service import ResumeDOCXService
from app.services.resume_content_override_service import (
    ResumeContentOverrideService,
)


class ResumeDocumentServiceTests(unittest.TestCase):
    @staticmethod
    def _mock_database():
        db = Mock()

        def assign_ids():
            records = [
                call.args[0]
                for call in db.add.call_args_list
            ]
            records.extend(
                record
                for call in db.add_all.call_args_list
                for record in call.args[0]
            )
            for record in records:
                if getattr(record, "id", None) is None:
                    record.id = uuid4()

        db.flush.side_effect = assign_ids
        return db

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
        db = self._mock_database()

        with patch(
            "app.services.resume_document_service.ResumeImportParser.parse",
            return_value=ResumeImportData(),
        ):
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
        db = self._mock_database()

        with patch(
            "app.services.resume_document_service.ResumeImportParser.parse",
            return_value=ResumeImportData(),
        ):
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
        db = self._mock_database()

        with patch(
            "app.services.resume_document_service.ResumeImportParser.parse",
            return_value=ResumeImportData(),
        ):
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

    def test_import_maps_structured_resume_data_to_profile_records_and_sections(self):
        source = Document()
        source.add_paragraph("Alex Example")
        output = BytesIO()
        source.save(output)
        db = self._mock_database()
        structured_data = ResumeImportData.model_validate({
            "personal_info": {
                "full_name": "Alex Example",
                "email": "alex@example.com",
                "phone": "+1 555 123 4567",
                "city": "Toronto",
                "professional_title": "Software Engineer",
                "summary": "Builds reliable applications.",
                "github_url": "github.com/alex",
            },
            "education": [{
                "institution_name": "Example University",
                "degree": "BSc",
                "field_of_study": "Computer Science",
                "start_date": "2021-09",
                "end_date": "2025-06",
                "grade": "3.8 GPA",
            }],
            "work_experience": [{
                "company_name": "Example Labs",
                "job_title": "Software Engineer",
                "start_date": "2023-02",
                "end_date": "Present",
                "is_current": True,
                "description": "Built an API used by 10K users.",
            }],
            "skills": ["Python", {"skill_name": "PostgreSQL", "category": "Database"}],
            "projects": [{
                "project_name": "Resume Studio",
                "role": "Developer",
                "technologies": "React, FastAPI",
                "project_url": "https://example.com/project",
            }],
            "achievements": [{
                "title": "Hackathon finalist",
                "issuing_organization": "Example Hack",
            }],
        })

        with patch(
            "app.services.resume_document_service.ResumeImportParser.parse",
            return_value=structured_data,
        ):
            profile, resume, _ = ResumeDocumentService.import_resume(
                db=db,
                filename="alex-resume.docx",
                content=output.getvalue(),
                profile_type="experienced",
                full_name=None,
                title=None,
                target_role=None,
            )

        self.assertEqual(profile.email, "alex@example.com")
        self.assertEqual(profile.city, "Toronto")
        self.assertEqual(profile.github_url, "https://github.com/alex")
        self.assertEqual(resume.source_text, "Alex Example")
        self.assertEqual(resume.target_role, "Software Engineer")

        created_records = [
            record
            for call in db.add_all.call_args_list
            for record in call.args[0]
        ]
        self.assertEqual(sum(isinstance(item, Education) for item in created_records), 1)
        self.assertEqual(sum(isinstance(item, WorkExperience) for item in created_records), 1)
        self.assertEqual(sum(isinstance(item, TechnicalSkill) for item in created_records), 2)
        self.assertEqual(sum(isinstance(item, Project) for item in created_records), 1)
        self.assertEqual(sum(isinstance(item, Achievement) for item in created_records), 1)
        imported_experience = next(
            item for item in created_records if isinstance(item, WorkExperience)
        )
        self.assertTrue(imported_experience.is_current)
        self.assertIsNone(imported_experience.end_date)

        section_items = [
            item for item in created_records if isinstance(item, ResumeSectionItem)
        ]
        self.assertEqual(
            {item.section_type for item in section_items},
            {"education", "work_experience", "technical_skill", "project", "achievement"},
        )
        self.assertTrue(all(item.resume_id == resume.id for item in section_items))

    def test_import_schema_ignores_malformed_entries_and_defaults_missing_sections(self):
        parsed = ResumeImportData.model_validate({
            "personal_info": None,
            "education": "not-an-array",
            "work_experience": [None, {"company_name": "Example Labs"}],
            "skills": ["Python", None, {"skill_name": "PostgreSQL"}],
        })

        self.assertEqual(parsed.personal_info.full_name, None)
        self.assertEqual(parsed.education, [])
        self.assertEqual(len(parsed.work_experience), 1)
        self.assertEqual(
            [skill.skill_name for skill in parsed.skills],
            ["Python", "PostgreSQL"],
        )

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
