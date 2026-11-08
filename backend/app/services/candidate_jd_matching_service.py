import logging
import re
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.schemas.candidate_jd_match import (
    CandidateJDMatchResponse,
    SkillMatch,
    EvidenceMatch,
    MatchCategoryScore,
)
from app.services.resume_analysis_service import ResumeAnalysisService
from app.services.job_description_service import JobDescriptionService

logger = logging.getLogger(__name__)


class CandidateJDMatchingService:

    WEIGHTS = {
        "mandatory_skills": 35,
        "preferred_skills": 10,
        "experience": 25,
        "projects": 15,
        "qualifications": 15,
    }

    STOP_WORDS = {
        "the", "and", "for", "with", "from", "this", "that",
        "have", "has", "had", "will", "would", "should",
        "must", "can", "you", "your", "our", "their",
        "years", "year", "experience", "knowledge",
        "ability", "strong", "good", "working", "work",
        "responsibilities", "including", "required",
        "preferred", "using", "used", "use", "role",
        "skills", "skill", "team", "teams",
    }

    SKILL_ALIASES = {
        "js": ["javascript"],
        "ts": ["typescript"],
        "postgres": ["postgresql"],
        "k8s": ["kubernetes"],
        "gcp": ["google cloud", "google cloud platform"],
        "aws": ["amazon web services"],
        "azure": ["microsoft azure"],
        "rest api": ["restful api", "restful services"],
        "llm": ["large language model"],
        "genai": ["generative ai"],
        "ml": ["machine learning"],
        "bdd": ["behavior driven development"],
        "tdd": ["test driven development"],
        "qa automation": ["automation testing", "test automation"],
        "ci/cd": ["continuous integration", "continuous delivery"],
    }

    @staticmethod
    def _normalize(text: str) -> str:
        text = (text or "").lower()
        text = text.replace("&", " and ")
        text = re.sub(r"[^a-z0-9+#]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    @classmethod
    def _contains(cls, text: str, term: str) -> bool:
        normalized_text = cls._normalize(text)
        normalized_term = cls._normalize(term)

        if not normalized_text or not normalized_term:
            return False

        return (
            f" {normalized_term} "
            in f" {normalized_text} "
        )

    @classmethod
    def _aliases(cls, skill: str) -> list[str]:
        normalized = cls._normalize(skill)

        aliases = [normalized]
        aliases.extend(cls.SKILL_ALIASES.get(normalized, []))

        for key, values in cls.SKILL_ALIASES.items():
            if normalized in values:
                aliases.append(key)

        return list(dict.fromkeys(aliases))

    @classmethod
    def _segments(cls, texts: list[str]) -> list[str]:
        segments = []

        for text in texts:
            if not text:
                continue

            for segment in re.split(
                r"[\n\r]+|(?<=[.!?])\s+",
                text,
            ):
                segment = segment.strip()

                if segment:
                    segments.append(segment[:1000])

        return segments

    @classmethod
    def _find_evidence(
        cls,
        texts: list[str],
        terms: list[str],
        limit: int = 3,
    ) -> list[str]:

        evidence = []
        seen = set()

        for segment in cls._segments(texts):
            if any(
                cls._contains(segment, term)
                for term in terms
            ):
                normalized = cls._normalize(segment)

                if normalized not in seen:
                    seen.add(normalized)
                    evidence.append(segment)

            if len(evidence) >= limit:
                break

        return evidence

    @classmethod
    def _match_skill(
        cls,
        requirement: dict,
        section_texts: dict,
        resume_text: str,
        importance: str,
    ) -> SkillMatch:

        skill_name = requirement.get("name", "").strip()
        category = requirement.get("category", "Other")

        aliases = cls._aliases(skill_name)

        all_texts = [resume_text] + list(section_texts.values())

        evidence = cls._find_evidence(
            all_texts,
            aliases,
        )

        if evidence:
            return SkillMatch(
                skill_name=skill_name,
                category=category,
                importance=importance,
                status="matched",
                match_percentage=100,
                evidence=evidence,
            )

        # Partial matching must be supported by a single
        # resume sentence or record, not scattered words.
        skill_tokens = [
            token
            for token in cls._normalize(skill_name).split()
            if len(token) > 2 and token not in cls.STOP_WORDS
        ]

        best_ratio = 0.0
        best_evidence = []

        if skill_tokens:
            for segment in cls._segments(all_texts):
                matched_tokens = [
                    token for token in skill_tokens
                    if cls._contains(segment, token)
                ]

                ratio = len(matched_tokens) / len(skill_tokens)

                if ratio > best_ratio:
                    best_ratio = ratio
                    best_evidence = [segment]

        if best_ratio >= 0.5:
            return SkillMatch(
                skill_name=skill_name,
                category=category,
                importance=importance,
                status="partial",
                match_percentage=round(best_ratio * 75, 2),
                evidence=best_evidence,
            )

        return SkillMatch(
            skill_name=skill_name,
            category=category,
            importance=importance,
            status="missing",
            match_percentage=0,
            evidence=[],
        )

    @classmethod
    def _match_skills(
        cls,
        requirements: list[dict],
        section_texts: dict,
        resume_text: str,
        importance: str,
    ) -> list[SkillMatch]:

        results = []

        for requirement in requirements:
            if not isinstance(requirement, dict):
                continue

            name = requirement.get("name")

            if not isinstance(name, str) or not name.strip():
                continue

            results.append(
                cls._match_skill(
                    requirement,
                    section_texts,
                    resume_text,
                    importance,
                )
            )

        return results

    @staticmethod
    def _skill_score(matches: list[SkillMatch]) -> float | None:
        if not matches:
            return None

        return round(
            sum(item.match_percentage for item in matches)
            / len(matches),
            2,
        )

    @classmethod
    def _requirement_tokens(cls, text: str) -> set[str]:
        return {
            token
            for token in cls._normalize(text).split()
            if len(token) > 2 and token not in cls.STOP_WORDS
        }

    @classmethod
    def _align_requirements(
        cls,
        requirements: list[str],
        source_texts: list[str],
    ) -> EvidenceMatch:

        requirements = [
            item.strip()
            for item in requirements
            if isinstance(item, str) and item.strip()
        ]

        if not requirements:
            return EvidenceMatch(
                requirement="No applicable requirement specified in the JD.",
                status="not_applicable",
                match_percentage=None,
                evidence=[],
            )

        segments = cls._segments(source_texts)

        matched_count = 0
        partial_count = 0
        evidence = []

        for requirement in requirements:
            normalized_requirement = cls._normalize(requirement)

            best_ratio = 0.0
            best_segment = None

            for segment in segments:
                normalized_segment = cls._normalize(segment)

                if normalized_requirement in (
                    f" {normalized_segment} "
                ):
                    best_ratio = 1.0
                    best_segment = segment
                    break

                required_tokens = cls._requirement_tokens(
                    requirement
                )

                if not required_tokens:
                    continue

                segment_tokens = cls._requirement_tokens(
                    segment
                )

                overlap = (
                    len(required_tokens.intersection(segment_tokens))
                    / len(required_tokens)
                )

                if overlap > best_ratio:
                    best_ratio = overlap
                    best_segment = segment

            if best_ratio >= 0.75:
                matched_count += 1
                if best_segment:
                    evidence.append(best_segment)

            elif best_ratio >= 0.5:
                partial_count += 1
                if best_segment:
                    evidence.append(best_segment)

        total = len(requirements)

        percentage = round(
            (
                matched_count + partial_count * 0.5
            ) / total * 100,
            2,
        )

        if matched_count == total:
            status = "matched"
        elif matched_count or partial_count:
            status = "partial"
        else:
            status = "missing"

        return EvidenceMatch(
            requirement="; ".join(requirements[:10]),
            status=status,
            match_percentage=percentage,
            evidence=list(dict.fromkeys(evidence))[:5],
        )

    @staticmethod
    def _alignment_score(alignment: EvidenceMatch) -> float | None:
        return alignment.match_percentage

    @classmethod
    def _calculate_score(
        cls,
        category_scores: dict[str, float | None],
    ) -> tuple[float, list[MatchCategoryScore]]:

        applicable = {
            category: score
            for category, score in category_scores.items()
            if score is not None
        }

        if not applicable:
            raise ValueError(
                "The job description does not contain enough "
                "requirements to calculate a meaningful match score."
            )

        total_weight = sum(
            cls.WEIGHTS[category]
            for category in applicable
        )

        breakdown = []
        overall_score = 0.0

        for category, score in applicable.items():
            original_weight = cls.WEIGHTS[category]

            effective_weight = (
                original_weight / total_weight
            ) * 100

            weighted_score = round(
                score * effective_weight / 100,
                2,
            )

            overall_score += weighted_score

            breakdown.append(
                MatchCategoryScore(
                    category=category,
                    weight=round(effective_weight, 2),
                    score=score,
                    weighted_score=weighted_score,
                    details=(
                        f"{category.replace('_', ' ').title()} "
                        "alignment based on selected resume content."
                    ),
                )
            )

        return round(overall_score, 2), breakdown

    @staticmethod
    def _match_label(score: float) -> str:
        if score >= 85:
            return "Strong Match"
        if score >= 70:
            return "Good Match"
        if score >= 50:
            return "Moderate Match"
        if score >= 30:
            return "Low Match"
        return "Very Low Match"

    @classmethod
    def match(
        cls,
        db: Session,
        resume_id: UUID,
        job_description: str,
    ) -> dict:

        resume = (
            db.query(Resume)
            .filter(Resume.id == resume_id)
            .first()
        )

        if not resume:
            raise LookupError("Resume not found.")

        resume_data = ResumeAnalysisService.get_resume_data(
            db,
            resume_id,
        )

        resume_text = resume_data["resume_text"]
        sections = resume_data["sections"]

        if not resume_text.strip():
            raise ValueError(
                "Resume does not contain sufficient content."
            )

        # Extract structured JD requirements.
        jd = JobDescriptionService.analyze(job_description)

        required_skills = jd.get("required_skills", [])
        preferred_skills = jd.get("preferred_skills", [])

        mandatory_matches = cls._match_skills(
            required_skills,
            sections,
            resume_text,
            "mandatory",
        )

        preferred_matches = cls._match_skills(
            preferred_skills,
            sections,
            resume_text,
            "preferred",
        )

        all_matches = mandatory_matches + preferred_matches

        matched_skills = [
            item for item in all_matches
            if item.status == "matched"
        ]

        partially_matched_skills = [
            item for item in all_matches
            if item.status == "partial"
        ]

        missing_skills = [
            item for item in all_matches
            if item.status == "missing"
        ]

        mandatory_score = cls._skill_score(
            mandatory_matches
        )

        preferred_score = cls._skill_score(
            preferred_matches
        )

        # Only selected work experience is considered here.
        experience_alignment = cls._align_requirements(
            jd.get("responsibilities", []),
            sections.get("work_experience", []),
        )

        # Project evidence is sourced exclusively from projects.
        project_requirements = jd.get("domain_keywords", [])

        project_alignment = cls._align_requirements(
            project_requirements,
            sections.get("project", []),
        )

        # Qualifications use education and certification sections.
        qualification_texts = (
            sections.get("education", [])
            + sections.get("certification", [])
        )

        qualification_requirements = (
            jd.get("required_qualifications", [])
        )

        qualification_alignment = cls._align_requirements(
            qualification_requirements,
            qualification_texts,
        )

        category_scores = {
            "mandatory_skills": mandatory_score,
            "preferred_skills": preferred_score,
            "experience": cls._alignment_score(
                experience_alignment
            ),
            "projects": cls._alignment_score(
                project_alignment
            ),
            "qualifications": cls._alignment_score(
                qualification_alignment
            ),
        }

        overall_score, breakdown = cls._calculate_score(
            category_scores
        )

        strengths = []
        opportunities = []

        if mandatory_score is not None and mandatory_score >= 75:
            strengths.append(
                "Strong alignment with mandatory technical skills."
            )

        if preferred_score is not None and preferred_score >= 75:
            strengths.append(
                "Good coverage of preferred technical skills."
            )

        if experience_alignment.status == "matched":
            strengths.append(
                "Selected work experience demonstrates relevant responsibilities."
            )

        if project_alignment.status == "matched":
            strengths.append(
                "Selected projects demonstrate relevant domain exposure."
            )

        if qualification_alignment.status == "matched":
            strengths.append(
                "Selected education and certifications align with the required qualifications."
            )

        if missing_skills:
            opportunities.append(
                "Review missing skills and include only those you genuinely possess."
            )

        if partially_matched_skills:
            opportunities.append(
                "Clarify partially matched skills with specific tools, technologies and examples."
            )

        if experience_alignment.status in ("partial", "missing"):
            opportunities.append(
                "Strengthen work experience descriptions with relevant responsibilities and actual examples."
            )

        if project_alignment.status in ("partial", "missing"):
            opportunities.append(
                "Highlight relevant projects and explain the technologies and work performed."
            )

        if qualification_alignment.status in ("partial", "missing"):
            opportunities.append(
                "Review the required qualifications and make relevant education or certification details visible."
            )

        if not strengths:
            strengths.append(
                "The resume provides a starting point for targeted improvements."
            )

        summary = (
            f"The resume has a {cls._match_label(overall_score).lower()} "
            f"with this job description, scoring {overall_score}/100. "
            f"It matches {len(matched_skills)} skills, partially matches "
            f"{len(partially_matched_skills)} skills and is missing "
            f"{len(missing_skills)} identified skills."
        )

        response = CandidateJDMatchResponse(
            resume_id=resume_id,
            job_title=jd.get("job_title"),
            target_role=resume.target_role,
            overall_match_score=overall_score,
            match_label=cls._match_label(overall_score),
            mandatory_skill_match_percentage=mandatory_score,
            preferred_skill_match_percentage=preferred_score,
            matched_skills=matched_skills,
            partially_matched_skills=partially_matched_skills,
            missing_skills=missing_skills,
            experience_alignment=experience_alignment,
            project_alignment=project_alignment,
            qualification_alignment=qualification_alignment,
            score_breakdown=breakdown,
            strengths=strengths,
            improvement_opportunities=opportunities,
            summary=summary,
        )

        return response.model_dump()