
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
            value = (overrides or {}).get(
                field,
                getattr(record, field, None),
            )

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
        all_overrides = (
            db.query(ResumeContentOverride)
            .filter(ResumeContentOverride.resume_id == resume_id)
            .order_by(
                ResumeContentOverride.updated_at.asc(),
                ResumeContentOverride.id.asc(),
            )
            .all()
        )
        override_values = {
            (
                item.section_type,
                str(item.source_item_id or ""),
                item.field_name,
            ): item.content
            for item in all_overrides
        }
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
    def _analyze_general(
        *,
        resume_id: UUID,
        resume_text: str,
        sections: dict,
        profile,
    ) -> dict:
        normalized = resume_text.lower()
        required_sections = (
            ("education", "technical_skill", "project")
            if profile.profile_type == "fresher"
            else (
                "education",
                "work_experience",
                "technical_skill",
                "project",
            )
        )
        present_sections = [
            section for section in required_sections if sections.get(section)
        ]
        section_score = round(
            len(present_sections) / len(required_sections) * 100,
            2,
        )

        has_email = bool(profile.email) or bool(
            re.search(r"\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b", normalized)
        )
        has_phone = bool(profile.phone) or bool(
            re.search(r"(?:\+?\d[\d\s().-]{7,}\d)", resume_text)
        )
        contact_score = 100 if has_email and has_phone else 65 if has_email or has_phone else 30

        word_count = len(resume_text.split())
        content_score = round(min(word_count / 250, 1) * 100, 2)
        lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
        bullet_lines = sum(
            line.startswith(("-", "•", "*", "·")) for line in lines
        )
        readability_score = (
            100
            if len(lines) >= 8 and (bullet_lines > 0 or len(present_sections) >= 3)
            else 65
            if len(lines) >= 4
            else 30
        )

        metrics = [
            ("section_coverage", 35, section_score, "Recognized resume sections are present."),
            ("contact_information", 25, contact_score, "Contact details help employers identify and reach you."),
            ("content_depth", 25, content_score, f"{word_count} words detected; concise, complete content improves parsing."),
            ("ATS_readability", 15, readability_score, "Based on text structure, headings, and bullet formatting."),
        ]
        breakdown = []
        score = 0.0
        for category, weight, value, details in metrics:
            weighted = round(value * weight / 100, 2)
            score += weighted
            breakdown.append({
                "category": category,
                "weight": weight,
                "score": value,
                "weighted_score": weighted,
                "details": details,
            })
        score = round(score, 2)

        strengths = []
        if has_email:
            strengths.append("Your resume includes an email contact.")
        if has_phone:
            strengths.append("Your resume includes a phone contact.")
        if len(present_sections) >= 3:
            strengths.append(
                f"{len(present_sections)} recognized resume sections were found."
            )
        if bullet_lines:
            strengths.append("Your resume uses bullet-style content that is easy to scan.")

        missing_sections = [
            section.replace("_", " ")
            for section in required_sections
            if section not in present_sections
        ]
        weaknesses = []
        recommendations = []
        if missing_sections:
            weaknesses.append(
                "The following sections were not detected: "
                + ", ".join(missing_sections)
                + "."
            )
            recommendations.append(
                "Add relevant details to the missing sections where applicable."
            )
        if not has_email or not has_phone:
            weaknesses.append("Contact information appears incomplete.")
            recommendations.append("Include a professional email address and phone number.")
        if word_count < 100:
            weaknesses.append("The resume contains limited searchable content.")
            recommendations.append("Add factual details about your experience, skills, projects, and education.")
        if readability_score < 100:
            weaknesses.append("Resume structure may be difficult for an ATS to scan.")
            recommendations.append("Use clear section headings and concise bullet points.")
        if not recommendations:
            recommendations.append("Review all details for accuracy and tailor this resume to each role.")
        if not strengths:
            strengths.append("The resume file was parsed successfully and is ready for improvement.")

        return {
            "resume_id": resume_id,
            "match_score": score,
            "score_label": ResumeAnalysisService._score_label(score),
            "score_breakdown": breakdown,
            "matched_keywords": [],
            "missing_keywords": [],
            "matched_skills": sorted(ResumeAnalysisService.extract_skills(resume_text)),
            "missing_skills": [],
            "strengths": strengths,
            "weaknesses": weaknesses,
            "recommendations": recommendations,
            "summary": (
                f"Your resume has a baseline ATS readiness score of {score}/100. "
                "Add a job description for role-specific keyword alignment."
            ),
        }

    @staticmethod
    def get_resume_text(db: Session, resume_id: UUID) -> tuple[str, set[str]]:
        resume_data = ResumeAnalysisService.get_resume_data(db, resume_id)
        text = resume_data["resume_text"]
        return text, ResumeAnalysisService.extract_skills(text)

    @staticmethod
    def analyze(
        db: Session,
        resume_id: UUID,
        job_description: str | None = None,
    ):
        resume_data = ResumeAnalysisService.get_resume_data(
            db,
            resume_id,
        )

        resume_text = resume_data["resume_text"]
        sections = resume_data["sections"]
        profile = ResumeAnalysisService._get_resume(
            db,
            resume_id,
        ).career_profile

        if not job_description:
            return ResumeAnalysisService._analyze_general(
                resume_id=resume_id,
                resume_text=resume_text,
                sections=sections,
                profile=profile,
            )

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

        if profile.profile_type == "fresher":
            experience_score = 100.0
            experience_details = (
                "Work experience is optional for fresher profiles."
            )
        elif not job_keywords:
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
        required_sections = (
            ["education", "technical_skill", "project"]
            if profile.profile_type == "fresher"
            else [
                "education",
                "work_experience",
                "technical_skill",
                "project",
            ]
        )

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
                f"All {len(required_sections)} core resume sections "
                "are populated."
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

        if not experience_text.strip() and profile.profile_type != "fresher":
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

        if experience_score < 50 and profile.profile_type != "fresher":
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
