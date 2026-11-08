import { apiRequest } from './client'
import type { ResumeAnalysis } from './types'

export function analyzeResume(
  resumeId: string,
  job_description?: string,
): Promise<ResumeAnalysis> {
  return apiRequest<ResumeAnalysis>(`/resumes/${resumeId}/analyze`, {
    method: 'POST',
    body: JSON.stringify({ job_description }),
  })
}
