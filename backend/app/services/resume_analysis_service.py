import re
from collections import Counter
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.models.resume_section_item import ResumeSectionItem
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
    "their", "he", "she", "his", "her", "will", "would",
    "should", "can", "could", "may", "might", "must",
    "have", "has", "had", "do", "does", "did",
    "about", "into", "through", "across", "using",
    "use", "used", "such", "etc", "including",
    "experience", "work", "working", "role", "responsibilities",
    "requirements", "required", "preferred", "ability",
    "strong", "good", "excellent", "candidate",
}


# Common technical skills and tools.
# This list can be expanded or moved into configuration later.
TECHNICAL_SKILLS = {
    "python", "java", "javascript", "typescript", "c++", "c#",
    "selenium", "playwright", "cypress", "appium",
    "restassured", "postman", "swagger", "pytest", "testng",
    "junit", "cucumber", "jmeter", "gatling",
    "sql", "postgresql", "mysql", "oracle", "mongodb",
    "bigquery", "snowflake", "redshift", "databricks",
    "pyspark", "spark", "hadoop", "hive", "kafka",
    "airflow", "dbt", "etl", "elt",
    "aws", "azure", "gcp", "docker", "kubernetes",
    "jenkins", "gitlab", "github", "maven", "gradle",
    "terraform", "linux", "git",
    "machine learning", "deep learning",
    "generative ai", "llm", "rag", "langchain",
    "langgraph", "openai", "vertex ai", "ollama",
    "mcp", "prompt engineering",
    "api testing", "automation testing",
    "manual testing", "performance testing",
    "regression testing", "integration testing",
    "unit testing", "bdd", "tdd",
    "microservices", "rest api", "graphql",
}


class ResumeAnalysisService:

    @staticmethod
    def normalize_text(text: str) -> str:
        return re.sub(
            r"[^a-z0-9+#.]",
            " ",
            text.lower(),
        )

    @staticmethod
    def extract_keywords(text: str) -> list[str]:
        normalized = ResumeAnalysisService.normalize_text(text)

        words = [
            word
            for word in normalized.split()
            if len(word) > 2 and word not in STOP_WORDS
        ]

        frequencies = Counter(words)

        # Keep meaningful keywords, excluding terms appearing only once
        # when the description is sufficiently long.
        keywords = [
            word
            for word, count in frequencies.most_common(60)
            if count >= 1
        ]

        return keywords

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
    def get_resume_text(db: Session, resume_id: UUID) -> tuple[str, set[str]]:
        resume = ResumeAnalysisService._get_resume(db, resume_id)

        profile = resume.career_profile

        parts = [
            profile.full_name or "",
            profile.professional_title or "",
            profile.summary or "",
        ]

        selected_items = ResumePreviewRepository.get_section_items(
            db=db,
            resume_id=resume_id,
        )

        grouped = {}

        for selected_item in selected_items:
            grouped.setdefault(
                selected_item.section_type, []
            ).append(selected_item)

        for section_type, model_class in SECTION_MODELS.items():
            section_items = grouped.get(section_type, [])

            section_items.sort(
                key=lambda item: item.display_order
            )

            item_ids = [item.item_id for item in section_items]

            records = ResumePreviewRepository.get_profile_items(
                db=db,
                model_class=model_class,
                item_ids=item_ids,
                career_profile_id=profile.id,
            )

            for record in records:
                parts.extend(
                    ResumeAnalysisService._record_to_text(record)
                )

        resume_text = " ".join(parts)

        resume_skills = ResumeAnalysisService.extract_skills(
            resume_text
        )

        return resume_text, resume_skills

    @staticmethod
    def _get_resume(db: Session, resume_id: UUID):
        resume = db.query(Resume).filter(
            Resume.id == resume_id
        ).first()

        if not resume:
            raise LookupError("Resume not found")

        return resume

    @staticmethod
    def _record_to_text(record) -> list[str]:
        values = []

        for field in (
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
        ):
            value = getattr(record, field, None)

            if value is not None:
                values.append(str(value))

        return values

    @staticmethod
    def analyze(
        db: Session,
        resume_id: UUID,
        job_description: str,
    ):
        resume_text, resume_skills = (
            ResumeAnalysisService.get_resume_text(
                db=db,
                resume_id=resume_id,
            )
        )

        resume_keywords = set(
            ResumeAnalysisService.extract_keywords(resume_text)
        )

        job_keywords = set(
            ResumeAnalysisService.extract_keywords(job_description)
        )

        job_skills = ResumeAnalysisService.extract_skills(
            job_description
        )

        matched_keywords = sorted(
            resume_keywords.intersection(job_keywords)
        )

        missing_keywords = sorted(
            job_keywords.difference(resume_keywords)
        )

        matched_skills = sorted(
            resume_skills.intersection(job_skills)
        )

        missing_skills = sorted(
            job_skills.difference(resume_skills)
        )

        keyword_score = (
            len(matched_keywords) / len(job_keywords) * 100
            if job_keywords else 0
        )

        skill_score = (
            len(matched_skills) / len(job_skills) * 100
            if job_skills else keyword_score
        )

        # Weighted heuristic score.
        match_score = round(
            (keyword_score * 0.4) + (skill_score * 0.6),
            2,
        )

        recommendations = []

        if missing_skills:
            recommendations.append(
                "Review the missing technical skills and add "
                "relevant ones only if you genuinely have that experience."
            )

        if missing_keywords:
            recommendations.append(
                "Consider incorporating relevant missing job-description "
                "keywords into your summary, skills, and experience bullets."
            )

        if len(resume_text.split()) < 150:
            recommendations.append(
                "Your resume content appears brief. Add relevant "
                "project details, responsibilities, and measurable outcomes."
            )

        if not recommendations:
            recommendations.append(
                "Your resume has good keyword overlap. Review the job "
                "requirements manually and ensure every claim is accurate."
            )

        if match_score >= 80:
            summary = "Strong keyword alignment with the job description."
        elif match_score >= 60:
            summary = "Moderate alignment. Some relevant keywords or skills are missing."
        elif match_score >= 40:
            summary = "Partial alignment. Consider improving relevant experience and skills coverage."
        else:
            summary = "Low keyword alignment. Review the job requirements and your resume content."

        return {
            "resume_id": resume_id,
            "match_score": match_score,
            "matched_keywords": matched_keywords,
            "missing_keywords": missing_keywords,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "recommendations": recommendations,
            "summary": summary,
        }