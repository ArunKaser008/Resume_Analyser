import re
from uuid import UUID

from sqlalchemy.orm import Session

from app.schemas.dashboard import (
    AnnotatedSection,
    DashboardResponse,
    DashboardScoreBreakdown,
    HighlightFlag,
    PriorityFix,
)
from app.services.resume_analysis_service import ResumeAnalysisService

METRIC_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\s*(?:%|x|ms|seconds?|qps|rps|users?)\b", re.I)
WEAK_PATTERN = re.compile(r"\b(helped|worked on|responsible for|assisted|participated in)\b", re.I)
RISK_PATTERN = re.compile(r"\b(objective|my career goal|references available upon request)\b", re.I)


class DashboardService:
    @staticmethod
    def build(db: Session, resume_id: UUID) -> DashboardResponse:
        resume = ResumeAnalysisService._get_resume(db, resume_id)
        data = ResumeAnalysisService.get_resume_data(db, resume_id)
        text = data["resume_text"] or data["source_text"] or ""
        skills = ResumeAnalysisService.extract_skills(text)
        source_text = data["source_text"] or ""
        section_lines = [
            line.strip()
            for values in data["sections"].values()
            for line in values
            if line.strip()
        ]
        annotation_source = source_text if "\n" in source_text else "\n".join(section_lines) or text
        lines = [line.strip() for line in annotation_source.splitlines() if line.strip()]
        sections = data["sections"]
        has_metrics = any(METRIC_PATTERN.search(line) for line in lines)
        has_link = bool(re.search(r"https?://(?:www\.)?github\.com/", text, re.I))
        has_leadership = bool(re.search(r"\b(led|mentored|owned|architected|managed)\b", text, re.I))
        has_heading = any(sections.values())
        breakdown = DashboardScoreBreakdown(
            hard_skills=min(100.0, len(skills) * 12.5),
            formatting=82.0 if has_heading else 45.0,
            proof_of_work=85.0 if has_link else (62.0 if sections.get("project") else 35.0),
            leadership=78.0 if has_leadership else 45.0,
        )
        overall = round(
            breakdown.hard_skills * 0.30
            + breakdown.formatting * 0.25
            + breakdown.proof_of_work * 0.25
            + breakdown.leadership * 0.20,
            1,
        )
        grade = "A+" if overall >= 95 else "A" if overall >= 85 else "B" if overall >= 70 else "C" if overall >= 55 else "F"
        annotations = []
        for line_number, line in enumerate(lines, 1):
            highlight = (
                HighlightFlag.STRONG_METRIC if METRIC_PATTERN.search(line)
                else HighlightFlag.WEAK_PHRASING if WEAK_PATTERN.search(line)
                else HighlightFlag.ATS_RISK if RISK_PATTERN.search(line)
                else None
            )
            annotations.append(AnnotatedSection(
                line_number=line_number,
                text=line,
                highlight=highlight,
            ))
        fixes = []
        if not has_metrics:
            fixes.append(PriorityFix(
                id="quantify-impact",
                title="Quantify one key outcome",
                description="Add a verified measure of scale, time saved, quality, or performance to a relevant bullet.",
                estimated_impact="+12 pts",
                line_number=next((i for i, line in enumerate(lines, 1) if line), 1),
            ))
        weak_line = next((i for i, line in enumerate(lines, 1) if WEAK_PATTERN.search(line)), None)
        if weak_line:
            fixes.append(PriorityFix(
                id="strengthen-action",
                title="Replace passive phrasing",
                description="Lead with the action you personally took and clarify your contribution.",
                estimated_impact="+8 pts",
                line_number=weak_line,
            ))
        if not has_link:
            fixes.append(PriorityFix(
                id="add-work-evidence",
                title="Add a work sample link",
                description="Include a relevant public code, portfolio, or project link where appropriate.",
                estimated_impact="+7 pts",
                line_number=max(1, len(lines)),
            ))
        if not has_heading:
            fixes.append(PriorityFix(
                id="standardize-sections",
                title="Use standard section headings",
                description="Label experience, education, skills, and projects with conventional ATS-readable headings.",
                estimated_impact="+9 pts",
                line_number=1,
            ))
        return DashboardResponse(
            analysis_id=resume_id,
            resume_id=resume_id,
            overall_score=overall,
            ats_grade=grade,
            target_role=resume.target_role or resume.career_profile.professional_title or "Target role not set",
            score_breakdown=breakdown,
            top_priority_fixes=fixes[:3],
            annotated_sections=annotations,
        )
