# MentorMuni Resume Intelligence

The frontend is a React/TypeScript application backed by the FastAPI service.
Set `VITE_API_BASE_URL` in `frontend/.env` to the backend `/api/v1` URL.

## Resume workflows

- The sidebar contains only ATS resume analysis, resume building, and
  job-description-based resume updates. No separate career-profile setup is
  exposed.
- **ATS resume analyser:** parse a PDF, DOCX, or TXT resume (up to 5 MB) into
  editable contact, education, skills, experience, and project details, then
  run a baseline ATS score. Proof of work checks project repositories and
  supplied GitHub/LeetCode profiles against their public APIs. Target role is
  not requested for Students. AI can suggest and stage changes for a selected
  weakness; final changes can update the existing resume or be saved as one of
  up to two copies.
- **Resume builder:** create a resume directly, build it from sections,
  edit contact details and summary, add standard or custom sections, and
  customize the template, one/two-column layout, font, accent color, spacing,
  page size, and section order. Preview and download it as PDF or DOCX. No
  separate career-profile setup is needed.
- **JD resume update:** use the resume active in the workspace, provide a job
  description, then accept/reject and apply suggestions individually. If no
  resume is active, select one from the workspace. Applied changes remain
  resume-specific and can be saved to the existing version or as one of up to
  two copies.

The resume parser stores extracted text and validated JSON in PostgreSQL.
Scanned PDFs use PyMuPDF OCR and require Tesseract OCR with English language
data installed. Configure `REDIS_URL` for distributed API rate limiting; it
is required outside development. Development without Redis uses a per-process
limiter.

Proof-of-work scores use project evidence (60%), GitHub activity (25%), and
LeetCode problem/contest data (15%), normalized across the signals supplied.
Projects are verified only when a public repository matches the submitted
GitHub owner and has recent public commits. Empty repositories and forks with
no commits ahead of their source are marked high risk; inaccessible or
inactive repositories remain unverified rather than being treated as proof of
misrepresentation.

Before starting the backend, install the repository requirements and apply
the backend requirements and Alembic migrations from `backend/`:

```powershell
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

PDF export uses the existing Playwright Chromium PDF renderer. DOCX export
uses the same backend-rendered resume preview.
