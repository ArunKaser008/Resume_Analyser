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
- **Resume builder:** choose a student, fresher, or experienced pathway; start
  from one of four ATS-first templates or import a PDF/DOCX (up to 5 MB); then
  edit personal information (including GitHub and LeetCode links), education,
  skills, experience, projects, certifications, and achievements beside a live
  preview. Entries can be
  reordered and removed with a short undo window. Changes autosave. The editor
  includes accent, font, spacing, and single-page-fit controls, a target-JD
  matcher, an ATS preflight action, and PDF, plain-text, and JSON exports. No
  separate career-profile setup is needed.
- **JD resume update:** upload a resume or choose a saved one, provide a job
  description, then accept/reject and apply suggestions individually. Applied
  changes remain resume-specific and can be saved to the existing version or
  as one of up to two copies.

The resume builder limits imports to 5 MB; other resume workflows accept files
up to 10 MB. Text is extracted from selectable PDF text, DOCX
paragraphs/tables, or UTF-8 TXT files; scanned image-only PDFs are not
OCR-processed.

Before starting the backend, install the repository requirements and apply
the Alembic migrations from `backend/`:

```powershell
python -m pip install -r ..\requirements.txt
python -m alembic upgrade head
```

PDF export uses the existing Playwright Chromium PDF renderer. DOCX export
uses the same backend-rendered resume preview.
