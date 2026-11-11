import re
from uuid import UUID

from sqlalchemy.orm import Session

from app.schemas.proof_of_work import (
    ProofOfWorkRequest,
    ProofStatus,
    ProjectClaim,
)
from app.schemas.dashboard import (
    DashboardScoreBreakdown,
    TierCheck,
    TierSimulationResponse,
    TierType,
)
from app.services.resume_analysis_service import ResumeAnalysisService

GITHUB_REPOSITORY_PATTERN = re.compile(
    r"https?://(?:www\.)?github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+",
    re.IGNORECASE,
)
LEETCODE_PROFILE_PATTERN = re.compile(
    r"https?://(?:www\.)?leetcode\.com/(?:u/)?[A-Za-z0-9_-]+/?",
    re.IGNORECASE,
)


def _score(condition: bool, positive: int = 100, negative: int = 25) -> float:
    return float(positive if condition else negative)


class SimulatorService:
    @staticmethod
    def proof_request(db: Session, resume_id: UUID) -> ProofOfWorkRequest:
        resume = ResumeAnalysisService._get_resume(db, resume_id)
        resume_data = ResumeAnalysisService.get_resume_data(db, resume_id)
        text = resume_data["resume_text"] or resume_data["source_text"] or ""
        leetcode_match = LEETCODE_PROFILE_PATTERN.search(text)
        project_claims = []
        for item in resume_data["sections"].get("project", []):
            repository_match = GITHUB_REPOSITORY_PATTERN.search(item)
            project_claims.append(ProjectClaim(
                title=item.strip()[:200] or "Resume project",
                code_url=repository_match.group(0) if repository_match else None,
                bullet_points=[item[:4000]],
            ))
        return ProofOfWorkRequest(
            github_url=resume.career_profile.github_url,
            leetcode_url=leetcode_match.group(0) if leetcode_match else None,
            projects=project_claims[:10],
        )

    @classmethod
    def simulate(
        cls,
        db: Session,
        resume_id: UUID,
        tier_type: TierType,
        proof_score: int = 0,
        proof_verified: bool = False,
    ) -> TierSimulationResponse:
        resume = ResumeAnalysisService._get_resume(db, resume_id)
        resume_data = ResumeAnalysisService.get_resume_data(db, resume_id)
        text = resume_data["resume_text"] or resume_data["source_text"]
        normalized = text.lower()
        sections = resume_data["sections"]
        has_metrics = bool(re.search(r"\b\d+(?:\.\d+)?\s*(?:%|x|ms|seconds?|qps|rps|users?)\b", normalized))
        has_architecture = any(term in normalized for term in (
            "architecture", "microservices", "distributed", "scalable", "system design",
        ))
        has_github_link = bool(
            re.search(r"https?://(?:www\.)?github\.com/[A-Za-z0-9-]+/[A-Za-z0-9_.-]+", normalized)
        )
        has_skills = bool(ResumeAnalysisService.extract_skills(text))
        has_headings = any(sections.values())
        has_degree = bool(re.search(r"\b(bachelor|master|b\.?tech|m\.?tech|degree|ph\.?d)\b", normalized))
        has_projects = bool(sections.get("project"))
        has_shipping = any(term in normalized for term in (
            "launched", "shipped", "deployed", "production", "released", "users",
        ))
        has_hackathon = "hackathon" in normalized

        checks_by_tier = {
            TierType.MAANG_PRODUCT: [
                ("Scale metrics", has_metrics, "Quantified latency, throughput, QPS, or impact.", 0.4),
                ("System architecture", has_architecture, "Evidence of architecture or distributed systems ownership.", 0.35),
                (
                    "Verified engineering",
                    proof_verified,
                    "Public GitHub/LeetCode evidence was independently verified."
                    if proof_verified
                    else "Public profile or repository evidence could not be verified.",
                    0.25,
                ),
            ],
            TierType.SERVICED_MNC: [
                ("Exact technical skills", has_skills, "Recognized technical skills are listed.", 0.45),
                ("Standard sections", has_headings, "Resume content is organized into recognizable sections.", 0.35),
                ("Academic qualifications", has_degree, "Degree or academic qualification is visible.", 0.2),
            ],
            TierType.SERIES_B_STARTUP: [
                ("Full-stack breadth", len(ResumeAnalysisService.extract_skills(text)) >= 3, "At least three recognized technologies are present.", 0.35),
                ("Production shipping", has_shipping, "Resume describes shipping, deployment, or production outcomes.", 0.35),
                ("Projects and hackathons", has_projects or has_hackathon, "Projects or hackathon work are represented.", 0.3),
            ],
        }
        selected = checks_by_tier[tier_type]
        checks = [
            TierCheck(
                name=name,
                passed=passed,
                score=_score(passed),
                detail=detail,
            )
            for name, passed, detail, _weight in selected
        ]
        overall = sum(check.score * item[3] for check, item in zip(checks, selected, strict=True))
        has_leadership = bool(re.search(r"\b(led|mentored|owned|architected|managed)\b", normalized))
        if tier_type == TierType.MAANG_PRODUCT:
            hard = (_score(has_metrics) + _score(has_architecture)) / 2
            formatting = _score(has_headings)
            proof = float(proof_score)
            leadership = _score(has_leadership or has_architecture)
        elif tier_type == TierType.SERVICED_MNC:
            hard = _score(has_skills)
            formatting = _score(has_headings)
            proof = _score(has_degree)
            leadership = _score(has_leadership)
        else:
            hard = _score(len(ResumeAnalysisService.extract_skills(text)) >= 3)
            formatting = _score(has_headings)
            proof = _score(has_projects or has_hackathon or has_github_link)
            leadership = _score(has_shipping)
        return TierSimulationResponse(
            resume_id=resume_id,
            tier_type=tier_type,
            overall_score=round(overall, 2),
            score_breakdown=DashboardScoreBreakdown(
                hard_skills=hard,
                formatting=formatting,
                proof_of_work=proof,
                leadership=leadership,
            ),
            checks=checks,
        )
