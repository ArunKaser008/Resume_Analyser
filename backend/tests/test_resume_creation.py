import unittest
from unittest.mock import Mock
from uuid import uuid4

from app.schemas.resume import ResumeCreate
from app.services.resume_service import create_resume


class ResumeCreationTests(unittest.TestCase):
    def test_creates_resume_without_explicit_career_profile(self):
        db = Mock()
        db.flush.side_effect = lambda: setattr(db.add.call_args_list[0].args[0], "id", uuid4())

        resume = create_resume(
            db,
            ResumeCreate(title="Avery Resume", full_name="Avery Example"),
        )

        profile = db.add.call_args_list[0].args[0]
        self.assertEqual(profile.full_name, "Avery Example")
        self.assertEqual(profile.profile_type, "experienced")
        self.assertEqual(resume.career_profile_id, profile.id)


if __name__ == "__main__":
    unittest.main()
