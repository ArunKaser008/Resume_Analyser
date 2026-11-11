import re
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.models.resume_content_override import ResumeContentOverride
from app.repositories.resume_preview_repository import (
    ResumePreviewRepository,
    SECTION_MODELS,
)


STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then",
    "is", "are", "was", "were", "be", "been", "being",
    "to", "of", "in", "on", "for", "with", "by", "at",
    "from", "as", "this", "that", "these", "those",
    "it", "its", "we", "our", "you", "your", "they",
    "their", "will", "would", "should", "can", "could",
    "may", "might", "must", "have", "has", "had",
    "do", "does", "did", "about", "into", "through",
    "across", "using", "use", "used", "such", "including",
    "experience", "work", "working", "role",
    "responsibilities", "requirements", "required",
    "preferred", "ability", "strong", "good", "excellent",
    "candidate", "knowledge", "skills", "skill",
    "looking", "seeking", "provide", "support",
    "team", "teams", "within",
}

TECHNICAL_SKILLS = {
    "python", "java", "javascript", "typescript", "react",
    "c++", "c#", "selenium", "playwright", "cypress",
    "appium", "restassured", "postman", "swagger",
    "pytest", "testng", "junit", "cucumber",
    "jmeter", "gatling", "sql", "postgresql",
    "mysql", "oracle", "mongodb", "bigquery",
    "snowflake", "redshift", "databricks",
    "pyspark", "spark", "hadoop", "hive",
    "kafka", "airflow", "dbt", "etl", "elt",
    "aws", "azure", "gcp", "docker",
    "kubernetes", "jenkins", "gitlab", "github",
    "maven", "gradle", "terraform", "linux",
    "git", "machine learning", "deep learning",
    "generative ai", "llm", "rag", "langchain",
    "langgraph", "openai", "vertex ai", "ollama",
    "mcp", "prompt engineering", "api testing",
    "automation testing", "manual testing",
    "performance testing", "regression testing",
    "integration testing", "unit testing",
    "bdd", "tdd", "microservices", "rest api",
    "graphql",
}


class ResumeAnalysisService:
    @staticmethod
    def normalize_text(text: str) -> str:
        return re.sub(r"[^a-z0-9+#.]", " ", (text or "").lower())

    @staticmethod
    def extract_keywords(text: str) -> set[str]:
        normalized = ResumeAnalysisService.normalize_text(text)
        return {
            word
            for word in normalized.split()
            if len(word) > 2 and word not in STOP_WORDS
        }

    @staticmethod
    def extract_skills(text: str) -> set[str]:
        normalized = ResumeAnalysisService.normalize_text(text)
        return {
            skill
            for skill in TECHNICAL_SKILLS
            if re.search(
                rf"(?<![a-z0-9]){re.escape(skill)}(?![a-z0-9])",
                normalized,
            )
        }

    @staticmethod
    def _get_resume(db: Session, resume_id: UUID):
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            raise LookupError("Resume not found")
        if not resume.career_profile:
            raise LookupError("Career profile not found")
        return resume

    @staticmethod
    def _record_to_text(record, overrides: dict | None = None) -> str:
        fields = (
            "company_name",
            "job_title",
            "institution_name",
            "degree",
            "field_of_study",
            "skill_name",
            "category",
            "proficiency_level",
            "project_name",
            "role",
            "technologies",
            "description",
            "responsibilities",
            "achievements",
            "certification_name",
            "issuing_organization",
            "title",
        )
        values = []
        for field in fields:
            value = (overrides or {}).get(field, getattr(record, field, None))
            if value is not None:
                if isinstance(value, list):
                    values.extend(str(item) for item in value)
                else:
                    values.append(str(value))
        return " ".join(values)

    @staticmethod
    def get_resume_data(
        db: Session,
        resume_id: UUID,
        *,
        include_drafts: bool = False,
    ):
        resume = ResumeAnalysisService._get_resume(db, resume_id)
        profile = resume.career_profile
        all_overrides = (
            db.query(ResumeContentOverride)
            .filter(ResumeContentOverride.resume_id == resume_id)
            .order_by(
                ResumeContentOverride.updated_at.asc(),
                ResumeContentOverride.id.asc(),
            )
            .all()
        )
        override_values = {}
        for item in all_overrides:
            if item.is_draft and not include_drafts:
                if item.draft_created:
                    continue
                content = item.previous_content
            else:
                content = item.content
            if content is not None:
                override_values[
                    (
                        item.section_type,
                        str(item.source_item_id or ""),
                        item.field_name,
                    )
                ] = content
        source_text_override = override_values.get(
            ("uploaded_resume", "", "source_text")
        )
        source_text = (
            source_text_override
            if source_text_override is not None
            else resume.source_text or ""
        )
        summary = override_values.get(
            ("summary", "", "summary"),
            profile.summary or "",
        )
        parts = [
            profile.full_name or "",
            profile.professional_title or "",
            summary,
        ]
        if source_text:
            parts.append(source_text)

        section_text = {section_type: [] for section_type in SECTION_MODELS}
        selected_items = ResumePreviewRepository.get_section_items(
            db=db,
            resume_id=resume_id,
        )
        grouped = {}
        for item in selected_items:
            grouped.setdefault(item.section_type, []).append(item)

        for section_type, model_class in SECTION_MODELS.items():
            section_items = sorted(
                grouped.get(section_type, []),
                key=lambda item: item.display_order,
            )
            item_ids = [item.item_id for item in section_items]
            if not item_ids:
                continue
            records = ResumePreviewRepository.get_profile_items(
                db=db,
                model_class=model_class,
                item_ids=item_ids,
                career_profile_id=profile.id,
            )
            records_by_id = {str(record.id): record for record in records}
            for item in section_items:
                record = records_by_id.get(str(item.item_id))
                if record:
                    record_overrides = {
                        field: content
                        for (override_section, item_id, field), content
                        in override_values.items()
                        if override_section == section_type
                        and item_id == str(record.id)
                    }
                    text = ResumeAnalysisService._record_to_text(
                        record,
                        record_overrides,
                    )
                    section_text[section_type].append(text)
                    parts.append(text)

        source_section_patterns = {
            "education": r"(?im)^\s*(education|academic background|qualifications)\s*:?\s*$",
            "work_experience": r"(?im)^\s*(work experience|professional experience|employment history|experience)\s*:?\s*$",
            "technical_skill": r"(?im)^\s*(technical skills?|skills|technologies|technical expertise)\s*:?\s*$",
            "project": r"(?im)^\s*(projects?|selected projects|personal projects)\s*:?\s*$",
            "certification": r"(?im)^\s*(certifications?|licenses?)\s*:?\s*$",
            "achievement": r"(?im)^\s*(achievements?|awards|accomplishments)\s*:?\s*$",
        }
        for section_type, pattern in source_section_patterns.items():
            if not section_text[section_type] and re.search(pattern, source_text):
                section_text[section_type].append(source_text)

        return {
            "resume_text": " ".join(parts),
            "sections": section_text,
            "source_text": source_text,
        }

    @staticmethod
    def get_resume_text(db: Session, resume_id: UUID) -> tuple[str, set[str]]:
        resume_data = ResumeAnalysisService.get_resume_data(db, resume_id)
        text = resume_data["resume_text"]
        return text, ResumeAnalysisService.extract_skills(text)
