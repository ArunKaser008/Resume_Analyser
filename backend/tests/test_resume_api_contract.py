import unittest

from app.main import app


class ResumeAPIContractTests(unittest.TestCase):
    def test_resume_upload_and_both_download_formats_are_registered(self):
        paths = app.openapi()["paths"]

        self.assertIn("/api/v1/resumes/import", paths)
        self.assertIn("post", paths["/api/v1/resumes/import"])
        self.assertIn(
            "/api/v1/resumes/{resume_id}/download",
            paths,
        )
        self.assertIn(
            "/api/v1/resumes/{resume_id}/download/docx",
            paths,
        )

    def test_resume_analysis_job_description_is_optional(self):
        spec = app.openapi()
        operation = spec["paths"][
            "/api/v1/resumes/{resume_id}/analyze"
        ]["post"]
        request_schema = spec["components"]["schemas"][
            operation["requestBody"]["content"]["application/json"]["schema"]["$ref"].split("/")[-1]
        ]

        self.assertNotIn("job_description", request_schema.get("required", []))

    def test_resume_creation_does_not_require_a_career_profile_id(self):
        spec = app.openapi()
        operation = spec["paths"]["/api/v1/resumes"]["post"]
        request_schema = spec["components"]["schemas"][
            operation["requestBody"]["content"]["application/json"]["schema"]["$ref"].split("/")[-1]
        ]

        self.assertNotIn("career_profile_id", request_schema.get("required", []))

    def test_resume_upload_does_not_require_a_candidate_name(self):
        spec = app.openapi()
        operation = spec["paths"]["/api/v1/resumes/import"]["post"]
        request_schema_name = operation["requestBody"]["content"]["multipart/form-data"]["schema"]["$ref"].split("/")[-1]
        request_schema = spec["components"]["schemas"][request_schema_name]

        self.assertNotIn("full_name", request_schema.get("required", []))


if __name__ == "__main__":
    unittest.main()
