import unittest
from types import SimpleNamespace

from app.services.resume_analysis_service import ResumeAnalysisService


class GeneralResumeAnalysisTests(unittest.TestCase):
    def test_baseline_analysis_returns_score_and_actionable_feedback(self):
        profile = SimpleNamespace(
            profile_type="experienced",
            full_name="Avery Example",
            email="avery@example.com",
            phone="+1 555 123 4567",
        )
        sections = {
            "education": ["Bachelor of Science"],
            "work_experience": ["Software Engineer"],
            "technical_skill": ["Python"],
            "project": [],
            "certification": [],
            "achievement": [],
        }

        result = ResumeAnalysisService._analyze_general(
            resume_id="resume-id",
            resume_text=(
                "Avery Example avery@example.com +1 555 123 4567\n"
                "Education\nBachelor of Science\nExperience\n"
                + "Built reliable software with Python. " * 35
            ),
            sections=sections,
            profile=profile,
        )

        self.assertEqual(result["resume_id"], "resume-id")
        self.assertGreater(result["match_score"], 0)
        self.assertTrue(result["score_breakdown"])
        self.assertTrue(result["strengths"])
        self.assertTrue(result["weaknesses"])
        self.assertTrue(result["recommendations"])


if __name__ == "__main__":
    unittest.main()
