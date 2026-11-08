import { apiRequest } from './client'
import type { Resume, ResumeCreate } from './types'
import { normalizeList } from './types'

export async function getResumes(): Promise<Resume[]> {
  const response = await apiRequest<unknown>('/resumes')
  return normalizeList<Resume>(response)
}

export function createResume(payload: ResumeCreate): Promise<Resume> {
  return apiRequest<Resume>('/resumes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}