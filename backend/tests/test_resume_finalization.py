import unittest

from app.services.resume_finalization_service import ResumeFinalizationService


class ResumeFinalizationTests(unittest.TestCase):
    def test_allows_at_most_two_saved_copies(self):
        ResumeFinalizationService._ensure_copy_limit(0)
        ResumeFinalizationService._ensure_copy_limit(1)

        with self.assertRaisesRegex(ValueError, "maximum of two"):
            ResumeFinalizationService._ensure_copy_limit(2)


if __name__ == "__main__":
    unittest.main()
