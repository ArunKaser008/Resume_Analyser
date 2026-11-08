import { apiRequest } from './client'
import type { ResumeAnalysis } from './types'

export function analyzeResume(
  resumeId: string,
  job_description?: string,
  include_drafts = false,
): Promise<ResumeAnalysis> {
  const query = include_drafts ? '?include_drafts=true' : ''
  return apiRequest<ResumeAnalysis>(`/resumes/${resumeId}/analyze${query}`, {
    method: 'POST',
    body: JSON.stringify({ job_description }),
  })
}
