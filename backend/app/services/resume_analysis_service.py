
import re
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume import Resume
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
    "python", "java", "javascript", "typescript",
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


EDUCATION_TERMS = {
    "bachelor", "bachelors", "master", "masters",
    "degree", "btech", "b.e", "mtech", "mca",
    "bca", "computer science", "engineering",
    "information technology", "phd",
}


class ResumeAnalysisService:

    WEIGHTS = {
        "technical_skills": 40,
        "keyword_alignment": 25,
        "experience_relevance": 15,
        "education_relevance": 10,
        "resume_completeness": 10,
    }

    @staticmethod
    def normalize_text(text: str) -> str:
        text = (text or "").lower()
        return re.sub(r"[^a-z0-9+#.]", " ", text)

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
        resume = (
            db.query(Resume)
            .filter(Resume.id == resume_id)
            .first()
        )

        if not resume:
            raise LookupError("Resume not found")

        if not resume.career_profile:
            raise LookupError("Career profile not found")

        return resume

    @staticmethod
    def _record_to_text(record) -> str:
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
            value = getattr(record, field, None)

            if value is not None:
                if isinstance(value, list):
                    values.extend(str(item) for item in value)
                else:
                    values.append(str(value))

        return " ".join(values)

    @staticmethod
    def get_resume_data(db: Session, resume_id: UUID):
        resume = ResumeAnalysisService._get_resume(
            db,
            resume_id,
        )

        profile = resume.career_profile

        parts = [
            profile.full_name or "",
            profile.professional_title or "",
            profile.summary or "",
        ]

        section_text = {
            section_type: []
            for section_type in SECTION_MODELS
        }

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

            item_ids = [
                item.item_id
                for item in section_items
            ]

            if not item_ids:
                continue

            records = ResumePreviewRepository.get_profile_items(
                db=db,
                model_class=model_class,
                item_ids=item_ids,
                career_profile_id=profile.id,
            )

            records_by_id = {
                str(record.id): record
                for record in records
            }

            for item in section_items:
                record = records_by_id.get(str(item.item_id))

                if record:
                    text = ResumeAnalysisService._record_to_text(
                        record
                    )

                    section_text[section_type].append(text)
                    parts.append(text)

        return {
            "resume_text": " ".join(parts),
            "sections": section_text,
        }

    @staticmethod
    def _percentage(matched, required) -> float:
        matched_set = set(matched or [])
        required_set = set(required or [])

        if not required_set:
            return 100.0

        matched_count = len(
            matched_set.intersection(required_set)
        )

        return round(
            (matched_count / len(required_set)) * 100,
            2,
        )

    @staticmethod
    def _score_label(score: float) -> str:
        if score >= 85:
            return "Excellent"
        if score >= 70:
            return "Good"
        if score >= 55:
            return "Moderate"
        if score >= 40:
            return "Needs Improvement"

        return "Low Alignment"

    @staticmethod
    def analyze(
        db: Session,
        resume_id: UUID,
        job_description: str,
    ):
        resume_data = ResumeAnalysisService.get_resume_data(
            db,
            resume_id,
        )

        resume_text = resume_data["resume_text"]
        sections = resume_data["sections"]

        job_keywords = ResumeAnalysisService.extract_keywords(
            job_description
        )

        resume_keywords = ResumeAnalysisService.extract_keywords(
            resume_text
        )

        job_skills = ResumeAnalysisService.extract_skills(
            job_description
        )

        resume_skills = ResumeAnalysisService.extract_skills(
            resume_text
        )

        matched_keywords = sorted(
            job_keywords.intersection(resume_keywords)
        )

        missing_keywords = sorted(
            job_keywords.difference(resume_keywords)
        )

        matched_skills = sorted(
            job_skills.intersection(resume_skills)
        )

        missing_skills = sorted(
            job_skills.difference(resume_skills)
        )

        # 1. Technical skills: 40%
        # If no recognized technical skills exist in the JD,
        # this category is treated as not applicable.
        skill_score = (
            ResumeAnalysisService._percentage(
                matched_skills,
                job_skills,
            )
            if job_skills
            else 100.0
        )

        # 2. Keyword alignment: 25%
        keyword_score = ResumeAnalysisService._percentage(
            matched_keywords,
            job_keywords,
        )

        # 3. Experience relevance: 15%
        experience_text = " ".join(
            sections.get("work_experience", [])
        )

        experience_keywords = (
            ResumeAnalysisService.extract_keywords(
                experience_text
            )
        )

        if not job_keywords:
            experience_score = 100.0
            experience_details = (
                "No measurable job-description keywords were detected."
            )
        elif not experience_text.strip():
            experience_score = 0.0
            experience_details = (
                "No work experience is selected in this resume."
            )
        else:
            experience_score = ResumeAnalysisService._percentage(
                experience_keywords.intersection(job_keywords),
                job_keywords,
            )
            experience_details = (
                "Keyword alignment within selected work experience."
            )

        # 4. Education relevance: 10%
        education_text = " ".join(
            sections.get("education", [])
        )

        jd_education_terms = (
            ResumeAnalysisService.extract_keywords(
                job_description
            ).intersection(EDUCATION_TERMS)
        )

        education_keywords = (
            ResumeAnalysisService.extract_keywords(
                education_text
            )
        )

        if jd_education_terms:
            education_score = ResumeAnalysisService._percentage(
                education_keywords.intersection(
                    jd_education_terms
                ),
                jd_education_terms,
            )

            education_details = (
                "Education alignment based on education-related "
                "terms found in the job description."
            )
        else:
            education_score = 100.0
            education_details = (
                "No specific education requirement was detected "
                "in the job description."
            )

        # 5. Resume completeness: 10%
        required_sections = [
            "education",
            "work_experience",
            "technical_skill",
            "project",
        ]

        present_sections = [
            section
            for section in required_sections
            if sections.get(section)
        ]

        completeness_score = round(
            len(present_sections)
            / len(required_sections)
            * 100,
            2,
        )

        scores = {
            "technical_skills": (
                skill_score,
                (
                    "Alignment between recognized required and "
                    "listed technical skills."
                    if job_skills
                    else "No recognized technical skill requirements "
                    "were detected in the job description."
                ),
            ),
            "keyword_alignment": (
                keyword_score,
                "Relevant job-description keyword coverage.",
            ),
            "experience_relevance": (
                experience_score,
                experience_details,
            ),
            "education_relevance": (
                education_score,
                education_details,
            ),
            "resume_completeness": (
                completeness_score,
                f"{len(present_sections)} of "
                f"{len(required_sections)} core sections populated.",
            ),
        }

        score_breakdown = []
        match_score = 0.0

        for category, weight in ResumeAnalysisService.WEIGHTS.items():
            score, details = scores[category]

            weighted_score = round(
                score * weight / 100,
                2,
            )

            match_score += weighted_score

            score_breakdown.append({
                "category": category,
                "weight": weight,
                "score": score,
                "weighted_score": weighted_score,
                "details": details,
            })

        match_score = round(match_score, 2)

        # Strengths
        strengths = []

        if matched_skills:
            strengths.append(
                f"Your resume includes {len(matched_skills)} "
                "technical skills identified in the job description."
            )

        if experience_score >= 60 and experience_text.strip():
            strengths.append(
                "Your work experience contains relevant "
                "job-description terminology."
            )

        if sections.get("project"):
            strengths.append(
                "Your resume includes project experience."
            )

        if completeness_score == 100:
            strengths.append(
                "All four core resume sections are populated."
            )

        # Weaknesses
        weaknesses = []

        if missing_skills:
            weaknesses.append(
                f"{len(missing_skills)} technical skills from the "
                "job description were not found in your resume."
            )

        if keyword_score < 50:
            weaknesses.append(
                "Your resume has limited keyword alignment "
                "with the job description."
            )

        if not experience_text.strip():
            weaknesses.append(
                "No work experience is selected in this resume."
            )

        if not sections.get("project"):
            weaknesses.append(
                "No projects are selected in this resume."
            )

        if not sections.get("education"):
            weaknesses.append(
                "No education details are selected in this resume."
            )

        # Recommendations
        recommendations = []

        if missing_skills:
            recommendations.append(
                "Review missing skills and include only those "
                "you genuinely possess."
            )

        if missing_keywords:
            recommendations.append(
                "Incorporate relevant missing keywords naturally "
                "into your summary and experience descriptions."
            )

        if experience_score < 50:
            recommendations.append(
                "Improve the descriptions of relevant responsibilities "
                "and accomplishments."
            )

        if not sections.get("project"):
            recommendations.append(
                "Add relevant projects to demonstrate practical skills."
            )

        if completeness_score < 100:
            recommendations.append(
                "Complete the missing core resume sections "
                "where applicable."
            )

        if not recommendations:
            recommendations.append(
                "Review every resume claim for accuracy and ensure "
                "your experience clearly demonstrates the job requirements."
            )

        summary = (
            f"Your resume has "
            f"{ResumeAnalysisService._score_label(match_score).lower()} "
            f"alignment with this job description, with an overall "
            f"compatibility score of {match_score}/100."
        )

        return {
            "resume_id": resume_id,
            "match_score": match_score,
            "score_label": ResumeAnalysisService._score_label(
                match_score
            ),
            "score_breakdown": score_breakdown,
            "matched_keywords": matched_keywords,
            "missing_keywords": missing_keywords,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "recommendations": recommendations,
            "summary": summary,
        }
