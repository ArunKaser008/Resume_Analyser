import { apiBlob, apiRequest, apiText } from './client'
import type {
  Resume,
  ResumeCreate,
  ResumeImportResponse,
  ResumeSections,
  ResumeTemplate,
  ResumeUpdate,
} from './types'

export async function getResumes(): Promise<Resume[]> {
  return apiRequest<Resume[]>('/resumes?limit=100')
}

export function createResume(payload: ResumeCreate): Promise<Resume> {
  return apiRequest<Resume>('/resumes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateResume(id: string, payload: ResumeUpdate): Promise<Resume> {
  return apiRequest<Resume>(`/resumes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteResume(id: string): Promise<void> {
  return apiRequest<void>(`/resumes/${id}`, { method: 'DELETE' })
}

export function getResumeSections(id: string): Promise<ResumeSections> {
  return apiRequest<ResumeSections>(`/resumes/${id}/sections`)
}

export function updateResumeSections(
  id: string,
  sections: ResumeSections['sections'],
): Promise<ResumeSections> {
  return apiRequest<ResumeSections>(`/resumes/${id}/sections`, {
    method: 'PUT',
    body: JSON.stringify({ sections }),
  })
}

export function updateResumeTemplate(
  id: string,
  template_name: ResumeTemplate,
): Promise<{ resume_id: string; template_name: ResumeTemplate; message: string }> {
  return apiRequest(`/resumes/${id}/template`, {
    method: 'PATCH',
    body: JSON.stringify({ template_name }),
  })
}

export function getResumePreview(id: string): Promise<string> {
  return apiText(`/resumes/${id}/preview`)
}

export function downloadResume(id: string): Promise<Blob> {
  return apiBlob(`/resumes/${id}/download`)
}

export function downloadResumeDocx(id: string): Promise<Blob> {
  return apiBlob(`/resumes/${id}/download/docx`)
}

export function importResume(
  file: File,
  profileType: 'fresher' | 'experienced',
  targetRole?: string,
): Promise<ResumeImportResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('profile_type', profileType)
  if (targetRole?.trim()) form.append('target_role', targetRole.trim())
  return apiRequest<ResumeImportResponse>('/resumes/import', {
    method: 'POST',
    body: form,
  })
}