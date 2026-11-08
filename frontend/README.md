# MentorMuni Resume Intelligence

The frontend is a React/TypeScript application backed by the FastAPI service.
Set `VITE_API_BASE_URL` in `frontend/.env` to the backend `/api/v1` URL.

## Resume workflows

- The sidebar contains only ATS resume analysis, resume building, and
  job-description-based resume updates. No separate career-profile setup is
  exposed.
- **ATS resume analyser:** upload a PDF, DOCX, or TXT resume, choose Fresher
  Student, or Experienced, and view a baseline ATS score. Target role is not
  requested for Students. An optional job description enables role-specific
  keyword analysis. AI can suggest and stage changes for a selected weakness;
  final changes can update the existing resume or be saved as one of up to two
  copies.
- **Resume builder:** create a resume directly, build it from sections,
  edit contact details and summary, add standard or custom sections, and
  customize the template, one/two-column layout, font, accent color, spacing,
  page size, and section order. Preview and download it as PDF or DOCX. No
  separate career-profile setup is needed.
- **JD resume update:** upload a resume or choose a saved one, provide a job
  description, then accept/reject and apply suggestions individually. Applied
  changes remain resume-specific and can be saved to the existing version or
  as one of up to two copies.

Uploads are limited to 10 MB. Text is extracted from selectable PDF text,
DOCX paragraphs/tables, or UTF-8 TXT files; scanned image-only PDFs are not
OCR-processed.

Before starting the backend, install the repository requirements and apply
the Alembic migrations from `backend/`:

```powershell
python -m pip install -r ..\requirements.txt
python -m alembic upgrade head
```

PDF export uses the existing Playwright Chromium PDF renderer. DOCX export
uses the same backend-rendered resume preview.
